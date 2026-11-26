package com.beibei.controller;

import com.beibei.service.*;
import org.springframework.web.bind.annotation.*;

// 兼容小程序约定的新路径，保留已有REST接口。
@RestController
@RequestMapping("/api")
public class FrontendController {
    private final WordService words;
    private final PkService pk;
    public FrontendController(WordService words,PkService pk) { this.words=words; this.pk=pk; }
    public static class WordBody { public Long wordId; }
    public static class MasteredBody { public Boolean mastered; }
    @GetMapping("/{book:vocabulary|wrong_words}")
    public Object list(@PathVariable String book,@RequestParam String openid,
                       @RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int pageSize,
                       @RequestParam(required=false) Integer level,@RequestParam(required=false) Boolean mastered) {
        return words.book(book,openid,page,pageSize,level,mastered);
    }
    @PostMapping("/{book:vocabulary|wrong_words}")
    public Object add(@PathVariable String book,@RequestParam String openid,@RequestBody WordBody body) {
        if(body.wordId==null || body.wordId<1) throw WordService.error(400,"缺少有效wordId");
        return words.changeBook(book,openid,body.wordId,true);
    }
    @DeleteMapping("/{book:vocabulary|wrong_words}/{id}")
    public Object remove(@PathVariable String book,@PathVariable Long id,@RequestParam String openid) {
        return words.changeBook(book,openid,id,false);
    }
    @PutMapping("/wrong_words/{id}/mastered")
    public Object mastered(@PathVariable Long id,@RequestParam String openid,@RequestBody MasteredBody body) {
        if(body.mastered==null) throw WordService.error(400,"缺少mastered");
        return words.setWrongMastered(openid,id,body.mastered);
    }
    @GetMapping("/stats")
    public Object stats(@RequestParam String openid) { return words.stats(openid); }
    @PostMapping("/pkroom")
    public Object create(@RequestParam String openid,@RequestBody ApiController.RoomBody body) {
        return pk.create(openid,body.level,body.count);
    }
    @GetMapping("/pkroom/{code}")
    public Object get(@PathVariable String code,@RequestParam String openid) { return pk.get(code,openid); }
    @PostMapping("/pkroom/{code}/join")
    public Object join(@PathVariable String code,@RequestParam String openid) { return pk.join(code,openid); }
    @PostMapping("/pkroom/{code}/prepare")
    public Object prepare(@PathVariable String code,@RequestParam String openid) { return pk.prepare(code,openid); }
    @PostMapping("/pkroom/{code}/start")
    public Object start(@PathVariable String code,@RequestParam String openid) { return pk.start(code,openid); }
    @DeleteMapping("/pkroom/{code}")
    public Object close(@PathVariable String code,@RequestParam String openid) { return pk.close(code,openid); }
    @PostMapping("/pkroom/{code}/answers")
    public Object answer(@PathVariable String code,@RequestParam String openid,@RequestBody ApiController.AnswerBody body) {
        if(body.index==null || body.choice==null) throw WordService.error(400,"缺少index或choice");
        return pk.answer(code,openid,body.index,body.choice);
    }
}

