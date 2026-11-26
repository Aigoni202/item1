package com.beibei.entity;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.*;
@TableName("checkins")
public class Checkin {
    public Long userId;
    public LocalDate checkinDate;
    public LocalDateTime createdAt;
}
