package com.beibei.controller;

import com.beibei.service.PkService;
import com.beibei.service.WordService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Collections;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

class ProgressControllerTest {
    private WordService words;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        words = mock(WordService.class);
        mvc = standaloneSetup(new ApiController(words, mock(PkService.class))).build();
    }

    @Test
    void putMarksWordLearned() throws Exception {
        when(words.setLearned("user-a", 11L, true))
                .thenReturn(Collections.singletonMap("learned", true));

        mvc.perform(put("/api/progress/11").param("openid", "user-a"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.learned").value(true));

        verify(words).setLearned("user-a", 11L, true);
    }

    @Test
    void deleteMarksWordUnlearned() throws Exception {
        when(words.setLearned("user-a", 11L, false))
                .thenReturn(Collections.singletonMap("learned", false));

        mvc.perform(delete("/api/progress/11").param("openid", "user-a"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.learned").value(false));

        verify(words).setLearned("user-a", 11L, false);
    }

    @Test
    void progressMutationRequiresOpenid() throws Exception {
        mvc.perform(put("/api/progress/11"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(words);
    }
}

