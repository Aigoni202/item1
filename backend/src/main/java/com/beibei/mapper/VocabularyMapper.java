package com.beibei.mapper;
import com.beibei.entity.Word;
import org.apache.ibatis.annotations.*;
import java.util.List;
public interface VocabularyMapper {
    @Select({"<script>SELECT word_id FROM vocabulary WHERE user_id=#{uid} AND word_id IN",
             "<foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach></script>"})
    List<Long> wordIds(@Param("uid") Long uid,@Param("ids") List<Long> ids);
    @Insert("INSERT INTO vocabulary(user_id,word_id) VALUES(#{uid},#{wid}) ON DUPLICATE KEY UPDATE word_id=VALUES(word_id)")
    void add(@Param("uid") Long uid,@Param("wid") Long wid);
    @Delete("DELETE FROM vocabulary WHERE user_id=#{uid} AND word_id=#{wid}")
    void remove(@Param("uid") Long uid,@Param("wid") Long wid);
    @Select("SELECT COUNT(*) FROM vocabulary WHERE user_id=#{uid}")
    long count(Long uid);
    @Select("SELECT w.* FROM vocabulary b JOIN words w ON w.id=b.word_id WHERE b.user_id=#{uid} " +
            "ORDER BY b.created_at DESC,w.id LIMIT #{size} OFFSET #{offset}")
    List<Word> list(@Param("uid") Long uid,@Param("size") int size,@Param("offset") long offset);
}
