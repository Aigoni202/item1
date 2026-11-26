USE word_db;

DROP PROCEDURE IF EXISTS verify_learning_progress;
DELIMITER //
CREATE PROCEDURE verify_learning_progress()
BEGIN
  DECLARE progress_table_count INT DEFAULT 0;
  DECLARE mastered_column_count INT DEFAULT 0;
  DECLARE mastered_at_column_count INT DEFAULT 0;
  DECLARE progress_pk_columns INT DEFAULT 0;
  DECLARE progress_foreign_keys INT DEFAULT 0;

  SELECT COUNT(*) INTO progress_table_count
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'user_word_progress';

  IF progress_table_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'user_word_progress table is missing';
  END IF;

  SELECT COUNT(*) INTO mastered_column_count
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'wrong_words'
    AND column_name = 'mastered'
    AND column_type = 'tinyint(1)'
    AND is_nullable = 'NO'
    AND column_default = '0';

  IF mastered_column_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'wrong_words.mastered is missing or invalid';
  END IF;

  SELECT COUNT(*) INTO mastered_at_column_count
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'wrong_words'
    AND column_name = 'mastered_at'
    AND data_type = 'datetime'
    AND is_nullable = 'YES';

  IF mastered_at_column_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'wrong_words.mastered_at is missing or invalid';
  END IF;

  SELECT COUNT(*) INTO progress_pk_columns
  FROM information_schema.key_column_usage
  WHERE table_schema = DATABASE()
    AND table_name = 'user_word_progress'
    AND constraint_name = 'PRIMARY'
    AND column_name IN ('user_id', 'word_id');

  IF progress_pk_columns <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'user_word_progress primary key is invalid';
  END IF;

  SELECT COUNT(*) INTO progress_foreign_keys
  FROM information_schema.key_column_usage
  WHERE table_schema = DATABASE()
    AND table_name = 'user_word_progress'
    AND referenced_table_name IN ('users', 'words')
    AND referenced_column_name = 'id';

  IF progress_foreign_keys <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'user_word_progress foreign keys are invalid';
  END IF;

  SELECT 'learning progress schema OK' AS verification_result;
END//
DELIMITER ;

CALL verify_learning_progress();
DROP PROCEDURE verify_learning_progress;

SELECT 'words' AS table_name, COUNT(*) AS row_count FROM words
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'vocabulary', COUNT(*) FROM vocabulary
UNION ALL SELECT 'wrong_words', COUNT(*) FROM wrong_words
UNION ALL SELECT 'checkins', COUNT(*) FROM checkins
UNION ALL SELECT 'pk_records', COUNT(*) FROM pk_records;

