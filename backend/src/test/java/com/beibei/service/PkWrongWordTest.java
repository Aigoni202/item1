package com.beibei.service;

import com.beibei.entity.PkRecord;
import com.beibei.mapper.PkRecordMapper;
import com.beibei.mapper.WordMapper;
import com.beibei.mapper.WrongWordMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.mockito.Mockito.*;

class PkWrongWordTest {
    private PkRecordMapper rooms;
    private WrongWordMapper wrong;
    private PkRecord room;
    private PkService service;

    @BeforeEach
    void setUp() {
        rooms = mock(PkRecordMapper.class);
        wrong = mock(WrongWordMapper.class);
        WordService users = mock(WordService.class);
        when(users.userId("user-a")).thenReturn(7L);
        service = new PkService(rooms, mock(WordMapper.class), users, new ObjectMapper(), wrong);
        room = new PkRecord();
        room.roomCode = "123456";
        room.ownerId = 7L;
        room.guestId = 9L;
        room.level = 4;
        room.status = "playing";
        room.questions = "[{\"wordId\":11,\"word\":\"sample\",\"options\":[\"错\",\"对\"],\"correct\":1}]";
        room.ownerAnswers = "{}";
        room.guestAnswers = "{\"0\":1}";
        room.expiresAt = LocalDateTime.now().plusMinutes(10);
        when(rooms.lockRoom("123456")).thenReturn(room);
    }

    @Test
    void incorrectAnswerAddsCurrentUsersWrongWordOnceEvenWhenRetried() {
        service.answer("123456", "user-a", 0, 0);
        service.answer("123456", "user-a", 0, 0);

        verify(wrong, times(1)).add(7L, 11L);
    }

    @Test
    void correctAnswerDoesNotAddWrongWord() {
        service.answer("123456", "user-a", 0, 1);

        verifyNoInteractions(wrong);
    }
}

