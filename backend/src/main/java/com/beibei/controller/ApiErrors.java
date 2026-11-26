package com.beibei.controller;
import com.beibei.service.WordService;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;
import org.slf4j.*;

@RestControllerAdvice
public class ApiErrors {
    private static final Logger log=LoggerFactory.getLogger(ApiErrors.class);
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<?> business(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatus()).body(WordService.map("detail",ex.getReason()));
    }
    @ExceptionHandler({MissingServletRequestParameterException.class,MethodArgumentTypeMismatchException.class,
                       HttpMessageNotReadableException.class})
    public ResponseEntity<?> input(Exception ex) {
        return ResponseEntity.badRequest().body(WordService.map("detail","缺少参数或参数格式错误"));
    }
    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<?> database(DataAccessException ex) {
        log.error("数据库操作失败",ex);
        return ResponseEntity.status(503).body(WordService.map("detail","数据库操作失败，请检查连接或稍后重试"));
    }
}
