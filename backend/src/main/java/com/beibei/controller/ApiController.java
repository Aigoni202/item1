package com.beibei.controller;

import com.beibei.entity.Word;
import com.beibei.service.PkService;
import com.beibei.service.WordService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class ApiController {
    private final WordService service;
    private final PkService pk;

    public ApiController(WordService service, PkService pk) {
        this.service = service;
        this.pk = pk;
    }

    public static class LoginBody {
        public String code;
        public String nickname = "微信用户";
        public String avatarUrl = "";
    }

    public static class RoomBody {
        public int level = 4;
        public int count = 10;
    }

    public static class AnswerBody {
        public Integer index;
        public Integer choice;
    }

    @PostMapping("/login")
    public Object login(@RequestBody LoginBody body) {
        return service.login(body.code, body.nickname, body.avatarUrl);
    }

    @GetMapping("/words")
    public Object words(@RequestParam(defaultValue = "4") int level,
                        @RequestParam(defaultValue = "1") int page,
                        @RequestParam(defaultValue = "30") int pageSize,
                        @RequestParam(defaultValue = "") String keyword,
                        @RequestParam(defaultValue = "") String letter,
                        @RequestParam(defaultValue = "all") String filter,
                        @RequestParam(defaultValue = "") String openid,
                        @RequestParam(defaultValue = "") String learnedIds) {
        return service.listWords(level, page, pageSize, keyword, letter, filter, openid, learnedIds);
    }

    @GetMapping("/words/{id}")
    public Word detail(@PathVariable Long id) {
        return service.detail(id);
    }

    @GetMapping("/books/{book}")
    public Object book(@PathVariable String book, @RequestParam String openid,
                       @RequestParam(defaultValue = "1") int page,
                       @RequestParam(defaultValue = "20") int pageSize) {
        return service.book(book, openid, page, pageSize);
    }

    @PutMapping("/books/{book}/{id}")
    public Object add(@PathVariable String book, @PathVariable Long id, @RequestParam String openid) {
        return service.changeBook(book, openid, id, true);
    }

    @DeleteMapping("/books/{book}/{id}")
    public Object remove(@PathVariable String book, @PathVariable Long id, @RequestParam String openid) {
        return service.changeBook(book, openid, id, false);
    }

    @PostMapping("/checkins")
    public Object checkin(@RequestParam String openid) {
        return service.checkin(openid);
    }

    @GetMapping("/checkins")
    public Object checkins(@RequestParam String openid,
                           @RequestParam(defaultValue = "1") int page,
                           @RequestParam(defaultValue = "31") int pageSize) {
        return service.checkins(openid, page, pageSize);
    }

    @PostMapping("/pk/rooms")
    public Object create(@RequestParam String openid, @RequestBody RoomBody body) {
        return pk.create(openid, body.level, body.count);
    }

    @PostMapping("/pk/rooms/{code}/join")
    public Object join(@PathVariable String code, @RequestParam String openid) {
        return pk.join(code, openid);
    }

    @GetMapping("/pk/rooms/{code}")
    public Object room(@PathVariable String code, @RequestParam String openid) {
        return pk.get(code, openid);
    }

    @PostMapping("/pk/rooms/{code}/answers")
    public Object answer(@PathVariable String code, @RequestParam String openid,
                         @RequestBody AnswerBody body) {
        if (body.index == null || body.choice == null) {
            throw WordService.error(400, "缺少index或choice");
        }
        return pk.answer(code, openid, body.index, body.choice);
    }

    @GetMapping("/pk/records")
    public Object records(@RequestParam String openid,
                          @RequestParam(defaultValue = "1") int page,
                          @RequestParam(defaultValue = "20") int pageSize) {
        return pk.records(openid, page, pageSize);
    }
}
