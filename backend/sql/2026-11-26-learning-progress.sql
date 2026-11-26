USE word_db;

CREATE TABLE IF NOT EXISTS user_word_progress (
  user_id INT UNSIGNED NOT NULL,
  word_id INT UNSIGNED NOT NULL,
  learned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, word_id),
  CONSTRAINT fk_progress_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_progress_word
    FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @has_mastered = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'wrong_words'
    AND column_name = 'mastered'
);
SET @add_mastered = IF(
  @has_mastered = 0,
  'ALTER TABLE wrong_words ADD COLUMN mastered TINYINT(1) NOT NULL DEFAULT 0 AFTER word_id',
  'SELECT 1'
);
PREPARE statement FROM @add_mastered;
EXECUTE statement;
DEALLOCATE PREPARE statement;

SET @has_mastered_at = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'wrong_words'
    AND column_name = 'mastered_at'
);
SET @add_mastered_at = IF(
  @has_mastered_at = 0,
  'ALTER TABLE wrong_words ADD COLUMN mastered_at DATETIME NULL AFTER mastered',
  'SELECT 1'
);
PREPARE statement FROM @add_mastered_at;
EXECUTE statement;
DEALLOCATE PREPARE statement;


