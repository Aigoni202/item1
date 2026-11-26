package com.beibei;
import com.beibei.service.WordService;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.*;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
@MapperScan("com.beibei.mapper")
public class BeibeiApplication {
    public static void main(String[] args) { SpringApplication.run(BeibeiApplication.class,args); }
    // 可选命令行导入，导入后继续启动服务。
    @Bean
    ApplicationRunner importWords(WordService service) {
        return args -> {
            if(args.containsOption("import-words"))
                service.importWords(args.getOptionValues("import-words").get(0));
        };
    }
}
