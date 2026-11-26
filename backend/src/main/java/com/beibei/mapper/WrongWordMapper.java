package com.beibei.mapper;
import org.apache.ibatis.annotations.*;
import java.util.List;
import java.util.Map;
public interface WrongWordMapper {
    @Insert("INSERT INTO wrong_words(user_id,word_id) VALUES(#{uid},#{wid}) " +
            "ON DUPLICATE KEY UPDATE mastered=0,mastered_at=NULL")
    void add(@Param("uid") Long uid,@Param("wid") Long wid);
    @Delete("DELETE FROM wrong_words WHERE user_id=#{uid} AND word_id=#{wid}")
    void remove(@Param("uid") Long uid,@Param("wid") Long wid);
    @Select({"<script>SELECT COUNT(*) FROM wrong_words b",
            "<if test='level != null'>JOIN words w ON w.id=b.word_id AND w.level=#{level}</if>",
            "WHERE b.user_id=#{uid}",
            "<if test='mastered != null'>AND b.mastered=#{mastered}</if>",
            "</script>"})
    long count(@Param("uid") Long uid,@Param("level") Integer level,@Param("mastered") Boolean mastered);
    @Select({"<script>SELECT w.id,w.word,w.level,w.phonetic,w.pos,w.meaning,w.explanation,w.letter,",
            "b.mastered AS mastered,b.mastered_at AS masteredAt FROM wrong_words b",
            "JOIN words w ON w.id=b.word_id WHERE b.user_id=#{uid}",
            "<if test='level != null'>AND w.level=#{level}</if>",
            "<if test='mastered != null'>AND b.mastered=#{mastered}</if>",
            "ORDER BY b.created_at DESC,w.id LIMIT #{size} OFFSET #{offset}</script>"})
    List<Map<String,Object>> list(@Param("uid") Long uid,@Param("level") Integer level,
                                  @Param("mastered") Boolean mastered,@Param("size") int size,
                                  @Param("offset") long offset);
    @Select("SELECT EXISTS(SELECT 1 FROM wrong_words WHERE user_id=#{uid} AND word_id=#{wid})")
    boolean exists(@Param("uid") Long uid,@Param("wid") Long wid);
    @Update("UPDATE wrong_words SET mastered=#{mastered}," +
            "mastered_at=CASE WHEN #{mastered} THEN CURRENT_TIMESTAMP ELSE NULL END " +
            "WHERE user_id=#{uid} AND word_id=#{wid}")
    void setMastered(@Param("uid") Long uid,@Param("wid") Long wid,@Param("mastered") boolean mastered);
}

