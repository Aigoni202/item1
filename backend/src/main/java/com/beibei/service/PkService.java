package com.beibei.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.beibei.entity.*;
import com.beibei.mapper.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.io.IOException;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;
import static com.beibei.service.WordService.*;

@Service
public class PkService {
    private final PkRecordMapper rooms;
    private final WordMapper words;
    private final WordService users;
    private final WrongWordMapper wrong;
    private final ObjectMapper json;
    public PkService(PkRecordMapper rooms,WordMapper words,WordService users,ObjectMapper json,WrongWordMapper wrong) {
        this.rooms=rooms; this.words=words; this.users=users; this.json=json; this.wrong=wrong;
    }
    public static class Question {
        public Long wordId;
        public String word;
        public List<String> options;
        public int correct;
    }
    private LocalDateTime now() { return LocalDateTime.now(ZoneId.of("Asia/Shanghai")); }
    private String write(Object value) {
        try { return json.writeValueAsString(value); }
        catch(IOException ex) { throw new IllegalStateException("JSON序列化失败",ex); }
    }
    private <T> T read(String value,TypeReference<T> type) {
        try { return json.readValue(value,type); }
        catch(IOException ex) { throw new IllegalStateException("房间数据异常",ex); }
    }
    private List<Question> questions(PkRecord r) { return read(r.questions,new TypeReference<List<Question>>(){}); }
    private Map<String,Integer> answers(String value) { return read(value,new TypeReference<Map<String,Integer>>(){}); }
    private PkRecord lock(String code) {
        PkRecord r=rooms.lockRoom(text(code,8,"roomCode").toUpperCase(Locale.ROOT));
        if(r==null) throw error(404,"房间不存在");
        if(Arrays.asList("waiting","joined","ready","playing").contains(r.status) && !r.expiresAt.isAfter(now())) {
            r.status="expired"; rooms.updateById(r);
        }
        return r;
    }
    private void member(PkRecord r,Long uid) {
        if(!uid.equals(r.ownerId) && !uid.equals(r.guestId)) throw error(403,"不是房间成员");
    }
    private Map<String,Object> view(PkRecord r,Long uid) {
        List<Question> questions=questions(r);
        Map<String,Integer> a=answers(r.ownerAnswers),b=answers(r.guestAnswers);
        int sa=0,sb=0;
        for(int i=0;i<questions.size();i++) {
            if(Objects.equals(a.get(""+i),questions.get(i).correct)) sa++;
            if(Objects.equals(b.get(""+i),questions.get(i).correct)) sb++;
        }
        boolean finished=r.status.equals("finished");
        List<Map<String,Object>> visible=new ArrayList<>();
        for(int i=0;i<questions.size();i++) {
            Question q=questions.get(i);
            Map<String,Object> item=map("index",i,"wordId",q.wordId,"word",q.word,"options",q.options);
            if(finished) item.put("correct",q.correct);
            visible.add(item);
        }
        Long winner=finished && sa!=sb?(sa>sb?r.ownerId:r.guestId):null;
        List<Map<String,Object>> results=new ArrayList<>();
        if(finished) for(int i=0;i<questions.size();i++) {
            Question q=questions.get(i);
            results.add(map("index",i,"word",q.word,"meaning",q.options.get(q.correct),
                "ownerCorrect",Objects.equals(a.get(""+i),q.correct),"guestCorrect",Objects.equals(b.get(""+i),q.correct)));
        }
        return map("roomCode",r.roomCode,"status",r.status,"level",r.level,"ownerId",r.ownerId,"guestId",r.guestId,
                "questions",visible,"ownerScore",sa,"guestScore",sb,"ownerProgress",a.size(),"guestProgress",b.size(),
                "myAnswers",uid.equals(r.ownerId)?a:b,"winnerId",winner,"expiresAt",r.expiresAt,"questionResults",results);
    }
    @Transactional
    public Map<String,Object> create(String openid,int level,int count) {
        level(level); if(count<1 || count>20) throw error(400,"题量为1—20");
        Long uid=users.userId(openid);
        List<Word> pool=words.selectList(new QueryWrapper<Word>().eq("level",level).last("ORDER BY RAND() LIMIT 200"));
        if(pool.size()<count || pool.stream().map(w->w.meaning).distinct().count()<4)
            throw error(400,"词库不足，至少需要四种不同释义及足量单词");
        List<Question> questions=new ArrayList<>();
        for(Word w:pool.subList(0,count)) {
            List<String> options=pool.stream().map(x->x.meaning).filter(x->!x.equals(w.meaning)).distinct().collect(Collectors.toList());
            Collections.shuffle(options); options=new ArrayList<>(options.subList(0,3));
            options.add(w.meaning); Collections.shuffle(options);
            Question q=new Question(); q.wordId=w.id; q.word=w.word; q.options=options; q.correct=options.indexOf(w.meaning);
            questions.add(q);
        }
        PkRecord r=new PkRecord();
        // 现有输入框仅支持六位数字，不修改WXML。
        r.roomCode=String.valueOf(100000+new java.security.SecureRandom().nextInt(900000));
        r.ownerId=uid; r.level=level; r.questions=write(questions);
        r.ownerAnswers="{}"; r.guestAnswers="{}"; r.status="waiting"; r.createdAt=now(); r.expiresAt=now().plusMinutes(30);
        rooms.insert(r); return view(r,uid);
    }
    @Transactional
    public Map<String,Object> join(String code,String openid) {
        Long uid=users.userId(openid); PkRecord r=lock(code);
        if(r.status.equals("expired")) throw error(409,"房间已过期");
        if(!uid.equals(r.ownerId) && !uid.equals(r.guestId)) {
            if(!r.status.equals("waiting") || r.guestId!=null) throw error(409,"房间已满或已结束");
            r.guestId=uid; r.status="joined"; rooms.updateById(r);
        }
        return view(r,uid);
    }
    @Transactional
    public Map<String,Object> get(String code,String openid) {
        Long uid=users.userId(openid); PkRecord r=lock(code); member(r,uid); return view(r,uid);
    }
    @Transactional
    public Map<String,Object> prepare(String code,String openid) {
        Long uid=users.userId(openid); PkRecord r=lock(code); member(r,uid);
        if(!uid.equals(r.guestId)) throw error(403,"仅好友可准备");
        if(!Arrays.asList("joined","ready").contains(r.status)) throw error(409,"当前不可准备");
        r.status="ready"; rooms.updateById(r); return view(r,uid);
    }
    @Transactional
    public Map<String,Object> start(String code,String openid) {
        Long uid=users.userId(openid); PkRecord r=lock(code); member(r,uid);
        if(!uid.equals(r.ownerId)) throw error(403,"仅房主可开始");
        if(!Arrays.asList("ready","playing").contains(r.status)) throw error(409,"请等待好友准备");
        r.status="playing"; rooms.updateById(r); return view(r,uid);
    }
    @Transactional
    public Map<String,Object> close(String code,String openid) {
        Long uid=users.userId(openid); PkRecord r=lock(code); member(r,uid);
        if(r.status.equals("finished")) throw error(409,"对战已结束");
        r.status="closed"; rooms.updateById(r); return map("ok",true);
    }
    @Transactional
    public Map<String,Object> answer(String code,String openid,int index,int choice) {
        Long uid=users.userId(openid); PkRecord r=lock(code); member(r,uid);
        List<Question> questions=questions(r);
        if(index<0 || index>=questions.size() || choice < -1 || choice>3) throw error(400,"题号或选项无效");
        boolean owner=uid.equals(r.ownerId);
        Map<String,Integer> mine=answers(owner?r.ownerAnswers:r.guestAnswers);
        String key=""+index;
        if(Objects.equals(mine.get(key),choice)) return view(r,uid); // 重试不重复计分。
        if(!r.status.equals("playing")) throw error(409,"当前房间不可答题");
        if(mine.containsKey(key)) throw error(409,"不能修改已提交答案");
        if(index!=mine.size()) throw error(400,"请按题目顺序作答");
        mine.put(key,choice);
        if(choice!=questions.get(index).correct) wrong.add(uid,questions.get(index).wordId);
        if(owner) r.ownerAnswers=write(mine); else r.guestAnswers=write(mine);
        if(answers(r.ownerAnswers).size()==questions.size() && answers(r.guestAnswers).size()==questions.size()) r.status="finished";
        rooms.updateById(r); return view(r,uid);
    }
    @Transactional
    public Map<String,Object> records(String openid,int page,int size) {
        Long uid=users.userId(openid); long start=offset(page,size);
        QueryWrapper<PkRecord> query=new QueryWrapper<PkRecord>().and(q->q.eq("owner_id",uid).or().eq("guest_id",uid));
        long total=rooms.selectCount(query);
        List<PkRecord> list=rooms.selectList(query.orderByDesc("id").last("LIMIT "+size+" OFFSET "+start));
        List<Map<String,Object>> result=new ArrayList<>();
        for(PkRecord r:list) result.add(view(lock(r.roomCode),uid));
        return page(result,total,page,size);
    }
}
