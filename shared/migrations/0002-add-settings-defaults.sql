-- Migration 0002: System Settings Defaults
-- Inserts default system settings and backup schedule singleton row
-- These are the minimum required rows for the application to function

-- System settings defaults
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('operator.name', ''),
  ('agent.autoDraftThreshold', '75'),
  ('agent.voiceAndTone', 'professional'),
  ('agent.maxConcurrentJobs', '3'),
  ('crawl.intervalHours', '168'),
  ('crawl.maxConcurrentCrawls', '1'),
  ('crawl.requestDelayMs', '2000'),
  ('crawl.respectRobotsTxt', '1'),
  ('crawl.userAgent', 'HackerDojoGrantOps/0.2'),
  ('backup.autoBackupEnabled', '0'),
  ('backup.intervalHours', '168'),
  ('backup.maxBackups', '10'),
  ('notifications.newGrantMatches', '1'),
  ('notifications.crawlCompleted', '1'),
  ('notifications.deadlineReminders', '1');

-- Backup schedule singleton (insert on first run, otherwise ignore)
INSERT OR IGNORE INTO backup_schedule (id, enabled, intervalHours, maxBackups)
  VALUES (1, 0, 168, 10);
