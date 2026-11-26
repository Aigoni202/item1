package com.beibei.mapper;
import com.beibei.entity.Word;
import org.apache.ibatis.annotations.*;
import java.util.List;
public interface WrongWordMapper {
    @Insert("INSERT INTO wrong_words(user_id,word_id) VALUES(#{uid},#{wid}) ON DUPLICATE KEY UPDATE word_id=VALUES(word_id)")
    void add(@Param("uid") Long uid,@Param("wid") Long wid);
    @Delete("DELETE FROM wrong_words WHERE user_id=#{uid} AND word_id=#{wid}")
    void remove(@Param("uid") Long uid,@Param("wid") Long wid);
    @Select("SELECT COUNT(*) FROM wrong_words WHERE user_id=#{uid}")
    long count(Long uid);
    @Select("SELECT w.* FROM wrong_words b JOIN words w ON w.id=b.word_id WHERE b.user_id=#{uid} " +
            "ORDER BY b.created_at DESC,w.id LIMIT #{size} OFFSET #{offset}")
    List<Word> list(@Param("uid") Long uid,@Param("size") int size,@Param("offset") long offset);
}
