package com.beibei.entity;
import com.baomidou.mybatisplus.annotation.*;
// 用公开字段省略重复访问器，不引入 Lombok。
@TableName("words")
public class Word {
    @TableId(type=IdType.AUTO) public Long id;
    public String word;
    public Integer level;
    public String phonetic;
    public String pos;
    public String meaning;
    public String explanation;
    public String letter;
}
