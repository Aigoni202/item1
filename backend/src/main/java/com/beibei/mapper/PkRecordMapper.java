package com.beibei.mapper;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.beibei.entity.PkRecord;
import org.apache.ibatis.annotations.*;
public interface PkRecordMapper extends BaseMapper<PkRecord> {
    // 事务内锁住房间，防止加入抢位、并发答题覆盖。
    @Select("SELECT * FROM pk_records WHERE room_code=#{code} FOR UPDATE")
    PkRecord lockRoom(String code);
}
