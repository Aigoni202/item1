package com.beibei.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.beibei.controller.FrontendController;
import com.beibei.entity.User;
import com.beibei.entity.Word;
import com.beibei.mapper.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Update;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import java.lang.reflect.Method;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

class WrongWordMasteryTest {
    private WordMapper words;
    private UserMapper users;
    private VocabularyMapper vocabulary;
    private WrongWordMapper wrong;
    private UserWordProgressMapper progress;
    private WordService service;

    @BeforeEach
    void setUp() {
        words = mock(WordMapper.class);
        users = mock(UserMapper.class);
        vocabulary = mock(VocabularyMapper.class);
        wrong = mock(WrongWordMapper.class);
        progress = mock(UserWordProgressMapper.class);
        service = new WordService(words, users, vocabulary, wrong, mock(CheckinMapper.class), progress,
                new ObjectMapper(), new RestTemplateBuilder());
    }

    @Test
    void filtersWrongWordsByLevelAndMasteryWithCorrectTotal() {
        stubUser("user-a", 7L);
        Map<String, Object> row = Collections.singletonMap("mastered", false);
        when(wrong.list(7L, 4, false, 20, 0L)).thenReturn(Collections.singletonList(row));
        when(wrong.count(7L, 4, false)).thenReturn(1L);

        Map<String, Object> result = service.book("wrong_words", "user-a", 1, 20, 4, false);

        assertEquals(1L, result.get("total"));
        assertEquals(Collections.singletonList(row), result.get("list"));
        verify(wrong).list(7L, 4, false, 20, 0L);
        verify(wrong).count(7L, 4, false);
    }

    @Test
    void rejectsMasteryChangeWhenWordIsNotInCurrentUsersWrongBook() {
        stubUser("user-a", 7L);
        when(wrong.exists(7L, 11L)).thenReturn(false);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.setWrongMastered("user-a", 11L, true));

        assertEquals(404, error.getRawStatusCode());
        verify(wrong, never()).setMastered(anyLong(), anyLong(), anyBoolean());
    }

    @Test
    void masteryMutationUsesResolvedUserAndReturnsFinalState() {
        stubUser("user-b", 9L);
        when(wrong.exists(9L, 11L)).thenReturn(true);

        Map<String, Object> result = service.setWrongMastered("user-b", 11L, true);

        assertEquals(Boolean.TRUE, result.get("mastered"));
        verify(wrong).setMastered(9L, 11L, true);
        verify(wrong, never()).setMastered(eq(7L), anyLong(), anyBoolean());
    }

    @Test
    void statisticsUseServerTablesAndOnlyUnmasteredWrongWords() {
        stubUser("user-a", 7L);
        when(words.selectCount(any(QueryWrapper.class))).thenReturn(100L);
        when(progress.count(7L, null)).thenReturn(30L);
        when(vocabulary.count(7L)).thenReturn(8L);
        when(wrong.count(7L, null, false)).thenReturn(5L);

        Map<String, Object> result = service.stats("user-a");
        Map<String, Object> stats = (Map<String, Object>) result.get("stats");

        assertEquals(100L, stats.get("total"));
        assertEquals(30L, stats.get("learned"));
        assertEquals(70L, stats.get("unlearned"));
        assertEquals(8L, stats.get("collected"));
        assertEquals(5L, stats.get("wrong"));
        verify(wrong).count(7L, null, false);
    }

    @Test
    void mapperSqlSetsAndClearsMasteredTimestampAndWrongUpsertResetsIt() throws Exception {
        Method setMastered = WrongWordMapper.class.getMethod("setMastered", Long.class, Long.class, boolean.class);
        String update = String.join(" ", setMastered.getAnnotation(Update.class).value());
        assertTrue(update.contains("mastered_at=CASE WHEN #{mastered} THEN CURRENT_TIMESTAMP ELSE NULL END"));
        assertTrue(update.contains("user_id=#{uid}") && update.contains("word_id=#{wid}"));

        Method add = WrongWordMapper.class.getMethod("add", Long.class, Long.class);
        String insert = String.join(" ", add.getAnnotation(Insert.class).value());
        assertTrue(insert.contains("mastered=0"));
        assertTrue(insert.contains("mastered_at=NULL"));
    }

    @Test
    void controllerExposesWrongFiltersMasteryAndStats() throws Exception {
        PkService pk = mock(PkService.class);
        MockMvc mvc = standaloneSetup(new FrontendController(service, pk)).build();
        stubUser("user-a", 7L);
        when(wrong.list(7L, 4, false, 20, 0L)).thenReturn(Collections.emptyList());
        when(wrong.count(7L, 4, false)).thenReturn(0L);
        when(wrong.exists(7L, 11L)).thenReturn(true);
        when(words.selectCount(any(QueryWrapper.class))).thenReturn(100L);
        when(progress.count(7L, null)).thenReturn(30L);
        when(vocabulary.count(7L)).thenReturn(8L);
        when(wrong.count(7L, null, false)).thenReturn(5L);

        mvc.perform(get("/api/wrong_words").param("openid", "user-a")
                        .param("level", "4").param("mastered", "false"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));
        mvc.perform(put("/api/wrong_words/11/mastered").param("openid", "user-a")
                        .contentType("application/json").content("{\"mastered\":true}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.mastered").value(true));
        mvc.perform(get("/api/stats").param("openid", "user-a"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.stats.wrong").value(5));
    }

    @Test
    void controllerRejectsNullMasteredValue() throws Exception {
        MockMvc mvc = standaloneSetup(new FrontendController(service, mock(PkService.class))).build();

        mvc.perform(put("/api/wrong_words/11/mastered").param("openid", "user-a")
                        .contentType("application/json").content("{}"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(users, wrong);
    }

    private void stubUser(String openid, Long id) {
        User user = new User();
        user.id = id;
        user.openid = openid;
        when(users.selectOne(any(QueryWrapper.class))).thenReturn(user);
    }
}

