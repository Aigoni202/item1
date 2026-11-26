package com.beibei.mapper;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.beibei.entity.User;
import org.apache.ibatis.annotations.*;
public interface UserMapper extends BaseMapper<User> {
    @Insert("INSERT INTO users(openid,nickname,avatar_url) VALUES(#{openid},#{nickname},#{avatarUrl}) " +
            "ON DUPLICATE KEY UPDATE nickname=VALUES(nickname),avatar_url=VALUES(avatar_url)")
    void saveLogin(User user);
}
