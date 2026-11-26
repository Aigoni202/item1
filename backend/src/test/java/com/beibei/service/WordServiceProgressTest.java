package com.beibei.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.beibei.entity.User;
import com.beibei.entity.Word;
import com.beibei.mapper.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.web.server.ResponseStatusException;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class WordServiceProgressTest {
    private WordMapper words;
    private UserMapper users;
    private VocabularyMapper vocabulary;
    private WrongWordMapper wrong;
    private CheckinMapper checkins;
    private UserWordProgressMapper progress;
    private WordService service;

    @BeforeEach
    void setUp() {
        words = mock(WordMapper.class);
        users = mock(UserMapper.class);
        vocabulary = mock(VocabularyMapper.class);
        wrong = mock(WrongWordMapper.class);
        checkins = mock(CheckinMapper.class);
        progress = mock(UserWordProgressMapper.class);
        service = new WordService(words, users, vocabulary, wrong, checkins, progress,
                new ObjectMapper(), new RestTemplateBuilder());
    }

    @Test
    void marksExistingWordLearnedForCurrentUser() {
        stubUser("user-a", 7L);
        when(words.selectById(11L)).thenReturn(word(11L, 4));

        Map<String, Object> result = service.setLearned("user-a", 11L, true);

        assertEquals(Boolean.TRUE, result.get("learned"));
        verify(progress).add(7L, 11L);
        verify(progress, never()).remove(anyLong(), anyLong());
    }

    @Test
    void repeatedUnlearnRemainsSuccessful() {
        stubUser("user-a", 7L);
        when(words.selectById(11L)).thenReturn(word(11L, 4));

        Map<String, Object> result = service.setLearned("user-a", 11L, false);

        assertEquals(Boolean.FALSE, result.get("learned"));
        verify(progress).remove(7L, 11L);
    }

    @Test
    void rejectsMissingWordWithoutWritingProgress() {
        stubUser("user-a", 7L);
        when(words.selectById(404L)).thenReturn(null);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.setLearned("user-a", 404L, true));

        assertEquals(404, error.getRawStatusCode());
        verifyNoInteractions(progress);
    }

    @Test
    void learnedFilterRequiresLoginIdentity() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.listWords(4, 1, 20, "", "", "learned", ""));

        assertEquals(400, error.getRawStatusCode());
        verify(words, never()).selectList(any());
    }

    @Test
    void listUsesDatabaseProgressAndReturnsLearnedFlag() {
        stubUser("user-a", 7L);
        Word word = word(11L, 4);
        when(words.selectCount(any(QueryWrapper.class))).thenReturn(1L);
        when(words.selectList(any(QueryWrapper.class))).thenReturn(Collections.singletonList(word));
        when(progress.wordIds(eq(7L), anyList())).thenReturn(Collections.singletonList(11L));

        Map<String, Object> result = service.listWords(4, 1, 20, "", "", "learned", "user-a");

        assertEquals(1L, result.get("total"));
        List<Map<String, Object>> list = (List<Map<String, Object>>) result.get("list");
        assertEquals(1, list.size());
        assertEquals(Boolean.TRUE, list.get(0).get("learned"));
        verify(progress).wordIds(7L, Collections.singletonList(11L));

        ArgumentCaptor<QueryWrapper<Word>> query = ArgumentCaptor.forClass(QueryWrapper.class);
        verify(words).selectCount(query.capture());
        assertTrue(query.getValue().getCustomSqlSegment().contains("user_word_progress"));
        assertTrue(query.getValue().getCustomSqlSegment().contains("EXISTS"));
    }

    @Test
    void progressLookupIsIsolatedByResolvedUserId() {
        stubUser("user-b", 9L);
        when(words.selectCount(any(QueryWrapper.class))).thenReturn(1L);
        when(words.selectList(any(QueryWrapper.class))).thenReturn(Arrays.asList(word(21L, 6)));
        when(progress.wordIds(eq(9L), anyList())).thenReturn(Collections.emptyList());

        Map<String, Object> result = service.listWords(6, 1, 20, "", "", "all", "user-b");

        List<Map<String, Object>> list = (List<Map<String, Object>>) result.get("list");
        assertEquals(Boolean.FALSE, list.get(0).get("learned"));
        verify(progress).wordIds(9L, Collections.singletonList(21L));
        verify(progress, never()).wordIds(eq(7L), anyList());
    }

    private void stubUser(String openid, Long id) {
        User user = new User();
        user.id = id;
        user.openid = openid;
        when(users.selectOne(any(QueryWrapper.class))).thenReturn(user);
    }

    private Word word(Long id, int level) {
        Word word = new Word();
        word.id = id;
        word.level = level;
        word.word = "sample";
        word.phonetic = "/sample/";
        word.pos = "n.";
        word.meaning = "示例";
        word.explanation = "示例";
        word.letter = "S";
        return word;
    }
}

