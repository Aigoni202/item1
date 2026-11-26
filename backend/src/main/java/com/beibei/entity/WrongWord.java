package com.beibei.entity;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
@TableName("wrong_words")
public class WrongWord {
    public Long userId;
    public Long wordId;
    public Boolean mastered;
    public LocalDateTime masteredAt;
    public LocalDateTime createdAt;
}

