package com.beibei.entity;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
// 联合主键由自定义 SQL 操作，不使用 selectById。
@TableName("vocabulary")
public class Vocabulary {
    public Long userId;
    public Long wordId;
    public LocalDateTime createdAt;
}
