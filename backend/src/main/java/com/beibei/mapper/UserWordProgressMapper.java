package com.beibei.mapper;

import org.apache.ibatis.annotations.*;
import java.util.List;

public interface UserWordProgressMapper {
    @Insert("INSERT INTO user_word_progress(user_id,word_id) VALUES(#{uid},#{wid}) " +
            "ON DUPLICATE KEY UPDATE learned_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP")
    void add(@Param("uid") Long uid, @Param("wid") Long wid);

    @Delete("DELETE FROM user_word_progress WHERE user_id=#{uid} AND word_id=#{wid}")
    void remove(@Param("uid") Long uid, @Param("wid") Long wid);

    @Select({"<script>SELECT COUNT(*) FROM user_word_progress p",
            "<if test='level != null'>JOIN words w ON w.id=p.word_id AND w.level=#{level}</if>",
            "WHERE p.user_id=#{uid}</script>"})
    long count(@Param("uid") Long uid, @Param("level") Integer level);

    @Select({"<script>SELECT word_id FROM user_word_progress WHERE user_id=#{uid} AND word_id IN",
            "<foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach></script>"})
    List<Long> wordIds(@Param("uid") Long uid, @Param("ids") List<Long> ids);
}

