package com.beibei.entity;
import com.baomidou.mybatisplus.annotation.*;
import java.time.LocalDateTime;
@TableName("users")
public class User {
    @TableId(type=IdType.AUTO) public Long id;
    public String openid;
    public String nickname;
    public String avatarUrl;
    public LocalDateTime createdAt;
}
