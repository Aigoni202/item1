# 导入本地四六级词库

在项目根目录执行：

```powershell
python -m pip install PyMySQL
python tools/import_words.py
```

提示时输入MySQL密码。默认127.0.0.1:3306、root、beibei_word，源目录自动定位到项目word-import。
仅检查JSON：`python tools/import_words.py --check`。
修改连接：`python tools/import_words.py --host 127.0.0.1 --port 3306 --user root --database beibei_word`。

不创建或删除表，所有写入在一个事务中完成；失败回滚。重复执行根据同词同级更新，保留原ID及个人词本引用。
同词同级按大小写不敏感匹配，源文件按名称排序，后出现记录覆盖前面的重复记录。
运行导入时避免其他程序同时导入/修改词库；脚本间通过MySQL命名锁避免并发。

自动识别现有字段：

- 当前项目结构：word、level、phonetic、pos、meaning、explanation、letter。
- 若表采用translation/example：meaning映射到translation，JSON没有example则留空，不把explanation冒充例句。
- 不插入来源no作为id，让数据库自动生成主键。

2026-11-15实测：21个文件、9951条源记录，同词同级去重后9942条（四级4424、六级5518），成功导入本机数据库。
工具本地依赖也已放在tools/.python-deps；无需安装时可在PowerShell先设置 `$env:PYTHONPATH = "$PWD\tools\.python-deps"` 再运行。
