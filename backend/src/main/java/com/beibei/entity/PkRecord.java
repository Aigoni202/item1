package com.beibei.entity;
import com.baomidou.mybatisplus.annotation.*;
import java.time.LocalDateTime;
@TableName("pk_records")
public class PkRecord {
    @TableId(type=IdType.AUTO) public Long id;
    public String roomCode;
    public Long ownerId;
    public Long guestId;
    public Integer level;
    public String questions;
    public String ownerAnswers;
    public String guestAnswers;
    public String status;
    public LocalDateTime createdAt;
    public LocalDateTime expiresAt;
}
