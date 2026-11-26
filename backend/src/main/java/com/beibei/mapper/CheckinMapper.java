package com.beibei.mapper;
import com.beibei.entity.Checkin;
import org.apache.ibatis.annotations.*;
import java.time.LocalDate;
import java.util.List;
public interface CheckinMapper {
    @Insert("INSERT INTO checkins(user_id,checkin_date) VALUES(#{uid},#{date}) ON DUPLICATE KEY UPDATE checkin_date=VALUES(checkin_date)")
    void add(@Param("uid") Long uid,@Param("date") LocalDate date);
    @Select("SELECT COUNT(*) FROM checkins WHERE user_id=#{uid}")
    long count(Long uid);
    @Select("SELECT * FROM checkins WHERE user_id=#{uid} ORDER BY checkin_date DESC LIMIT #{size} OFFSET #{offset}")
    List<Checkin> list(@Param("uid") Long uid,@Param("size") int size,@Param("offset") long offset);
}
