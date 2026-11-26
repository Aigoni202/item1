"""导入word-import/*.json，不删表、不清空数据、保留已有单词ID。

安装依赖：python -m pip install PyMySQL
运行：python tools/import_words.py
仅检查JSON：python tools/import_words.py --check
密码默认交互输入，也可通过环境变量MYSQL_PASSWORD提供。
"""
import argparse
import getpass
import json
import os
from collections import Counter
from pathlib import Path


def read_source(directory):
    files = sorted(directory.glob('*.json'))
    if not files:
        raise ValueError(f'没有找到JSON文件：{directory}')
    rows = {}
    source_count = 0
    for file in files:
        with file.open(encoding='utf-8-sig') as stream:
            items = json.load(stream)
        if not isinstance(items, list):
            raise ValueError(f'{file.name}：顶层必须是数组')
        for index, item in enumerate(items, 1):
            if not isinstance(item, dict):
                raise ValueError(f'{file.name} 第{index}项不是对象')
            word = str(item.get('word', '')).strip()
            meaning = str(item.get('meaning', '')).strip()
            level = item.get('level')
            if not word or not meaning or type(level) is not int or level not in (4, 6):
                raise ValueError(f'{file.name} 第{index}项缺少word/meaning/level(4或6)')
            values = dict(word=word, level=level, phonetic=str(item.get('phonetic') or ''),
                          pos=str(item.get('pos') or ''), meaning=meaning,
                          explanation=str(item.get('explanation') or meaning),
                          letter=str(item.get('letter') or word[0]).upper()[:1],
                          translation=meaning, example=str(item.get('example') or ''))
            # 源数据没有例句时留空，不把释义冒充英文例句。
            key = (word.casefold(), level)
            # MySQL默认词库不区分大小写；按文件名顺序后出现的同词同级覆盖。
            rows[key] = values
            source_count += 1
    return files, source_count, list(rows.values())


def import_rows(args, rows):
    import pymysql
    password = os.getenv('MYSQL_PASSWORD')
    if password is None:
        password = getpass.getpass('MySQL密码：')
    connection = pymysql.connect(host=args.host, port=args.port, user=args.user,
                                 password=password, database=args.database, charset='utf8mb4',
                                 autocommit=False, connect_timeout=5,
                                 cursorclass=pymysql.cursors.DictCursor)
    locked = False
    try:
        with connection.cursor() as cursor:
            cursor.execute('SHOW FULL COLUMNS FROM words')
            schema = {col['Field']: col for col in cursor.fetchall()}
            base = {'id', 'level', 'word', 'phonetic'}
            if not base.issubset(schema) or not ({'meaning', 'translation'} & schema.keys()):
                raise ValueError('words表缺少必要字段；请先导入项目word.sql，脚本不会自动改表')
            fields = [name for name in rows[0] if name in schema]
            for name, col in schema.items():
                if name not in fields and col['Null'] == 'NO' and col['Default'] is None and 'auto_increment' not in col['Extra']:
                    raise ValueError(f'表中存在无法赋值的必填字段：{name}')
            # 提前校验实际VARCHAR长度，避免依赖MySQL非严格模式截断。
            for row in rows:
                for field in fields:
                    kind = schema[field]['Type'].lower()
                    if kind.startswith(('varchar(', 'char(')):
                        maximum = int(kind.split('(')[1].split(')')[0])
                        if len(str(row[field])) > maximum:
                            raise ValueError(f'{row["word"]} 的{field}超过表字段长度{maximum}')
            cursor.execute('SELECT GET_LOCK(%s,10) AS acquired', (args.database + ':words:json-import',))
            if cursor.fetchone()['acquired'] != 1:
                raise ValueError('另一个导入正在运行，请稍后重试')
            locked = True
            cursor.execute('SELECT id,word,level FROM words FOR UPDATE')
            existing = {}
            for row in cursor.fetchall():
                key = (row['word'].casefold(), row['level'])
                if key in existing:
                    raise ValueError(f'数据库已存在重复单词：{row["word"]}/{row["level"]}，请先人工确认')
                existing[key] = row['id']
            inserts, updates = [], []
            quoted = ','.join(f'`{field}`' for field in fields)
            for row in rows:
                values = tuple(row[field] for field in fields)
                key = (row['word'].casefold(), row['level'])
                if key in existing:
                    updates.append(values + (existing[key],))
                else:
                    inserts.append(values)
            insert_sql = f'INSERT INTO words ({quoted}) VALUES ({",".join(["%s"] * len(fields))})'
            update_sql = 'UPDATE words SET ' + ','.join(f'`{field}`=%s' for field in fields) + ' WHERE id=%s'
            for sql, batch in ((insert_sql, inserts), (update_sql, updates)):
                for start in range(0, len(batch), 500):
                    cursor.executemany(sql, batch[start:start + 500])
            cursor.execute('SELECT level,COUNT(*) AS total FROM words GROUP BY level ORDER BY level')
            totals = cursor.fetchall()
        connection.commit()
        print(f'导入完成：新增{len(inserts)}条，更新{len(updates)}条。')
        print('实际写入字段：' + ', '.join(fields))
        print('数据库词数：' + '，'.join(f'{r["level"]}级={r["total"]}' for r in totals))
    except Exception:
        connection.rollback()
        raise
    finally:
        if locked:
            with connection.cursor() as cursor:
                cursor.execute('SELECT RELEASE_LOCK(%s)', (args.database + ':words:json-import',))
        connection.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path(__file__).resolve().parents[1] / 'word-import')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=3306)
    parser.add_argument('--user', default='root')
    parser.add_argument('--database', default='beibei_word')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    files, count, rows = read_source(args.source)
    print(f'已检查{len(files)}个JSON文件，源记录{count}条，去重后{len(rows)}条。')
    print('源词数：' + '，'.join(f'{level}级={total}' for level, total in sorted(Counter(r['level'] for r in rows).items())))
    if not args.check:
        import_rows(args, rows)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # 不打印连接参数和密码，也不泄露驱动的连接错误详情。
        if isinstance(error, (ValueError, FileNotFoundError, json.JSONDecodeError)):
            print(f'导入失败：{error}')
        elif isinstance(error, ModuleNotFoundError):
            print('请先执行：python -m pip install PyMySQL')
        else:
            print(f'导入失败（{type(error).__name__}）：请检查MySQL连接、权限与表结构；事务已回滚。')
        raise SystemExit(1)
