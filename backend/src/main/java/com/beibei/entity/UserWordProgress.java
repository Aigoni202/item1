package com.beibei.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("user_word_progress")
public class UserWordProgress {
    public Long userId;
    public Long wordId;
    public LocalDateTime learnedAt;
    public LocalDateTime updatedAt;
}

