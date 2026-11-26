package com.beibei.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.beibei.entity.*;
import com.beibei.mapper.*;
import com.fasterxml.jackson.databind.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.*;
import org.springframework.web.server.ResponseStatusException;
import java.io.IOException;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.stream.*;

@Service
public class WordService {
    private final WordMapper words;
    private final UserMapper users;
    private final VocabularyMapper vocabulary;
    private final WrongWordMapper wrong;
    private final CheckinMapper checkins;
    private final UserWordProgressMapper progress;
    private final ObjectMapper json;
    private final RestTemplate http;
    @Value("${wechat.appid}") private String appid;
    @Value("${wechat.secret}") private String secret;

    public WordService(WordMapper words,UserMapper users,VocabularyMapper vocabulary,
                       WrongWordMapper wrong,CheckinMapper checkins,UserWordProgressMapper progress,
                       ObjectMapper json,RestTemplateBuilder builder) {
        this.words=words; this.users=users; this.vocabulary=vocabulary;
        this.wrong=wrong; this.checkins=checkins; this.progress=progress; this.json=json;
        http=builder.setConnectTimeout(Duration.ofSeconds(5)).setReadTimeout(Duration.ofSeconds(8)).build();
    }
    public static ResponseStatusException error(int status,String message) {
        return new ResponseStatusException(HttpStatus.valueOf(status),message);
    }
    public static Map<String,Object> map(Object... pairs) {
        Map<String,Object> result=new LinkedHashMap<>();
        for(int i=0;i<pairs.length;i+=2) result.put((String)pairs[i],pairs[i+1]);
        return result;
    }
    public static String text(String value,int max,String name) {
        if(value==null || value.trim().isEmpty() || value.length()>max) throw error(400,"参数错误："+name);
        return value.trim();
    }
    public static void level(int value) {
        if(value!=4 && value!=6) throw error(400,"级别只能是4或6");
    }
    public static long offset(int page,int size) {
        if(page<1 || size<1 || size>100) throw error(400,"page>=1，pageSize为1—100");
        return (page-1L)*size;
    }
    public static Map<String,Object> page(Object list,long total,int page,int size) {
        return map("list",list,"total",total,"page",page,"pageSize",size);
    }

    // 仅根据客户端提供的 openid 查用户，不证明请求者身份。
    public Long userId(String openid) {
        User user=users.selectOne(new QueryWrapper<User>().eq("openid",text(openid,64,"openid")));
        if(user==null) throw error(404,"用户不存在，请先微信登录");
        return user.id;
    }
    @Transactional
    public Map<String,Object> login(String code,String nickname,String avatarUrl) {
        text(code,256,"code");
        if(appid.trim().isEmpty() || secret.trim().isEmpty()) throw error(503,"请配置微信AppID、AppSecret");
        JsonNode result;
        try {
            String response=http.getForObject("https://api.weixin.qq.com/sns/jscode2session"+
                    "?appid={appid}&secret={secret}&js_code={code}&grant_type=authorization_code",
                    String.class,appid,secret,code);
            result=json.readTree(response==null?"{}":response);
        } catch(RestClientException | IOException ex) { throw error(502,"微信登录服务暂不可用"); }
        String openid=result==null?"":result.path("openid").asText("");
        if(openid.isEmpty()) throw error(400,"微信code无效或已使用，请重新wx.login");
        User user=new User(); user.openid=openid; user.nickname=text(nickname,100,"nickname");
        if(avatarUrl==null || avatarUrl.length()>1000) throw error(400,"avatarUrl过长");
        user.avatarUrl=avatarUrl; users.saveLogin(user);
        User saved=users.selectOne(new QueryWrapper<User>().eq("openid",openid));
        // 只返回 openid 和用户资料，不返回微信 session_key。
        return map("openid",openid,"user",saved);
    }
    public Map<String,Object> listWords(int level,int page,int size,String keyword,String letter,String filter,String openid) {
        level(level); long start=offset(page,size);
        if(keyword.length()>100) throw error(400,"搜索词过长");
        QueryWrapper<Word> query=new QueryWrapper<Word>().eq("level",level);
        if(!keyword.isEmpty()) query.apply("LOCATE({0},word)>0",keyword);
        else if(!letter.isEmpty()) {
            if(!letter.matches("[A-Za-z]")) throw error(400,"字母必须为A-Z");
            query.eq("letter",letter.toUpperCase(Locale.ROOT));
        }
        if(!Arrays.asList("all","collected","learned","unlearned").contains(filter)) throw error(400,"筛选类型错误");
        Long uid=openid.isEmpty()?null:userId(openid);
        if(filter.equals("collected")) {
            if(uid==null) return page(Collections.emptyList(),0,page,size);
            query.apply("EXISTS (SELECT 1 FROM vocabulary v WHERE v.word_id=words.id AND v.user_id={0})",uid);
        }
        if(filter.equals("learned") || filter.equals("unlearned")) {
            if(uid==null) uid=userId(openid);
            query.apply((filter.equals("learned")?"EXISTS":"NOT EXISTS")+
                    " (SELECT 1 FROM user_word_progress p WHERE p.word_id=words.id AND p.user_id={0})",uid);
        }
        long total=words.selectCount(query);
        // 仅拼接已校验数值，不拼接任意用户输入。
        List<Word> list=words.selectList(query.orderByAsc("word","id").last("LIMIT "+size+" OFFSET "+start));
        Set<Long> collected=new HashSet<>();
        if(uid!=null && !list.isEmpty()) {
            List<Long> ids=list.stream().map(w->w.id).collect(Collectors.toList());
            collected.addAll(vocabulary.wordIds(uid,ids));
        }
        Set<Long> learned=new HashSet<>();
        if(uid!=null && !list.isEmpty()) {
            List<Long> ids=list.stream().map(w->w.id).collect(Collectors.toList());
            learned.addAll(progress.wordIds(uid,ids));
        }
        List<Map<String,Object>> result=new ArrayList<>();
        for(Word w:list) result.add(map("id",w.id,"word",w.word,"level",w.level,"phonetic",w.phonetic,
                "pos",w.pos,"meaning",w.meaning,"explanation",w.explanation,"letter",w.letter,
                "collected",collected.contains(w.id),"learned",learned.contains(w.id)));
        return page(result,total,page,size);
    }
    public Word detail(Long id) {
        Word word=words.selectById(id);
        if(word==null) throw error(404,"单词不存在");
        return word;
    }
    public Map<String,Object> detail(Long id,String openid) {
        Word word=detail(id);
        Long uid=openid==null || openid.isEmpty()?null:userId(openid);
        boolean learned=uid!=null && progress.wordIds(uid,Collections.singletonList(id)).contains(id);
        boolean collected=uid!=null && vocabulary.wordIds(uid,Collections.singletonList(id)).contains(id);
        return map("id",word.id,"word",word.word,"level",word.level,"phonetic",word.phonetic,
                "pos",word.pos,"meaning",word.meaning,"explanation",word.explanation,"letter",word.letter,
                "learned",learned,"collected",collected);
    }
    @Transactional
    public Map<String,Object> setLearned(String openid,Long wordId,boolean learned) {
        Long uid=userId(openid); detail(wordId);
        if(learned) progress.add(uid,wordId); else progress.remove(uid,wordId);
        return map("learned",learned);
    }
    private boolean isVocabulary(String book) {
        if(!book.equals("vocabulary") && !book.equals("wrong_words")) throw error(400,"词本不存在");
        return book.equals("vocabulary");
    }
    public Map<String,Object> book(String book,String openid,int page,int size) {
        return book(book,openid,page,size,null,null);
    }
    public Map<String,Object> book(String book,String openid,int page,int size,Integer level,Boolean mastered) {
        boolean collected=isVocabulary(book); long start=offset(page,size); Long uid=userId(openid);
        if(level!=null) level(level);
        return collected?page(vocabulary.list(uid,size,start),vocabulary.count(uid),page,size)
                        :page(wrong.list(uid,level,mastered,size,start),wrong.count(uid,level,mastered),page,size);
    }
    @Transactional
    public Map<String,Object> changeBook(String book,String openid,Long wid,boolean add) {
        boolean collected=isVocabulary(book); Long uid=userId(openid);
        if(add) detail(wid);
        if(collected) { if(add) vocabulary.add(uid,wid); else vocabulary.remove(uid,wid); }
        else { if(add) wrong.add(uid,wid); else wrong.remove(uid,wid); }
        return map("ok",true);
    }
    @Transactional
    public Map<String,Object> setWrongMastered(String openid,Long wid,boolean mastered) {
        Long uid=userId(openid);
        if(!wrong.exists(uid,wid)) throw error(404,"错词不存在");
        wrong.setMastered(uid,wid,mastered);
        return map("mastered",mastered);
    }
    public Map<String,Object> stats(String openid) {
        Long uid=userId(openid);
        long total=words.selectCount(new QueryWrapper<Word>());
        long learned=progress.count(uid,null);
        return map("stats",map("total",total,"learned",learned,"unlearned",total-learned,
                "collected",vocabulary.count(uid),"wrong",wrong.count(uid,null,false)));
    }
    public Map<String,Object> checkin(String openid) {
        LocalDate today=LocalDate.now(ZoneId.of("Asia/Shanghai"));
        checkins.add(userId(openid),today); return map("ok",true,"date",today);
    }
    public Map<String,Object> checkins(String openid,int page,int size) {
        long start=offset(page,size); Long uid=userId(openid);
        return page(checkins.list(uid,size,start),checkins.count(uid),page,size);
    }

    // 命令行导入 JSON 文件或目录；同词同级更新，整批失败回滚。
    @Transactional(rollbackFor=Exception.class)
    public void importWords(String source) throws IOException {
        Path path=Paths.get(source); List<Path> files;
        if(Files.isDirectory(path)) {
            try(Stream<Path> stream=Files.list(path)) {
                files=stream.filter(p->p.toString().endsWith(".json")).sorted().collect(Collectors.toList());
            }
        } else files=Collections.singletonList(path);
        if(files.isEmpty()) throw new IllegalArgumentException("没有JSON文件");
        int count=0;
        for(Path file:files) {
            String content=new String(Files.readAllBytes(file),java.nio.charset.StandardCharsets.UTF_8);
            JsonNode root=json.readTree(content.startsWith("\uFEFF")?content.substring(1):content);
            if(root!=null && root.isObject()) root=root.has("words")?root.get("words"):root.get("data");
            if(root==null || !root.isArray()) throw new IllegalArgumentException("格式错误："+file);
            for(JsonNode item:root) {
                Word word=new Word(); word.word=text(item.path("word").asText(),100,"word");
                word.level=item.path("level").asInt(); level(word.level);
                word.meaning=text(item.path("meaning").asText(),15000,"meaning");
                word.phonetic=item.path("phonetic").asText(""); word.pos=item.path("pos").asText("");
                word.explanation=item.path("explanation").asText(word.meaning);
                if(word.phonetic.length()>255 || word.pos.length()>50 || word.explanation.length()>15000)
                    throw new IllegalArgumentException("字段过长："+word.word);
                word.letter=word.word.substring(0,1).toUpperCase(Locale.ROOT);
                if(!word.letter.matches("[A-Z]")) word.letter="";
                Word old=words.selectOne(new QueryWrapper<Word>().eq("word",word.word).eq("level",word.level));
                if(old==null) words.insert(word); else { word.id=old.id; words.updateById(word); }
                count++;
            }
        }
        System.out.println("单词导入完成，源记录："+count);
    }
}

