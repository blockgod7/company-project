# 휴가·전자결재 운영 전환 점검표

## 정책 확정

- 휴가관리자는 경조 유형과 관계별 허용일수, 유·무급, 증빙, 시행기간을 사내 취업규칙과 대조한다.
- 같은 경조 유형·관계의 활성 시행기간은 겹치지 않게 등록한다.
- 통합 휴가정책에서 사용하지 않는 휴가 유형은 비활성화한다.
- 2028년 이후 법정공휴일은 공공데이터 서비스 키를 설정하고 영향 미리보기 후 반영한다.

입력 준비에는 `templates/bereavement-policy-input.csv`를 사용한다. 이 파일은 정책 결정용 작업표이며 DB에 자동 반영되지 않는다.
입력 후 `./validate-bereavement-policy-input.ps1`로 코드, 날짜, 필수값과 중복을 검사한 다음 관리자 화면에 등록한다.

공공데이터 서비스 키를 발급받은 뒤 `./test-holiday-open-api.ps1 -Year 2028`로 실연동을 확인한다. 서비스 키는 파일이나 명령 인자에 저장하지 않고 `HOLIDAY_OPEN_API_SERVICE_KEY` 환경변수로 전달한다.

## 배포 전

1. `./backup-groupware.ps1 -IncludeUploads -PruneExpired -RetentionDays 30 -MinimumBackups 7`로 DB와 첨부파일을 백업한다.
2. `./verify-release.ps1`로 백엔드, 프런트, DB 검증을 수행한다.
3. 운영 환경에서는 `LOGIN_OPTIONS_ENABLED=false`, 강한 `JWT_SECRET`, HTTPS 쿠키 설정을 확인한다.
4. 휴가관리 화면에서 자동 작업 상태가 `FAILED`가 아닌지 확인한다.

## 복원 훈련

1. `./test-backup-restore.ps1 -BackupFile <dump>`를 실행해 격리된 임시 PostgreSQL에서 복원과 구조 검증을 수행한다.
2. 고정 검증 DB를 사용할 때는 `./restore-groupware.ps1 -BackupFile <dump> -TargetDbName <검증DB>`로 아카이브를 먼저 검증한다.
3. 검증 성공 후에만 `-ConfirmRestore`를 붙여 검증 DB에 복원한다.
4. `./verify-local-db.ps1 -DbName <검증DB> -SkipBackendHealth -SkipSeedCheck`를 실행한다.

복원 스크립트는 명시한 대상 DB의 객체를 교체하므로 운영 DB에 바로 실행하지 않는다.

## 자동 백업

1. `./set-backup-credential.ps1`을 대화형으로 한 번 실행한다. 자격 증명은 현재 Windows 사용자만 복호화할 수 있는 형식으로 `backups/`에 저장된다.
2. `./install-backup-task.ps1`을 실행하면 매일 02:00에 백업하고, 30일이 지난 파일을 정리하되 최근 7개는 항상 유지한다.
3. `Start-ScheduledTask -TaskName "Groupware Daily Backup"`으로 즉시 한 번 실행하고 `backups/logs/` 결과를 확인한다.
4. 제거가 필요하면 `./uninstall-backup-task.ps1`을 실행한다.

백업·복원 스크립트에는 비밀번호 기본값이 없으며 `DB_PASSWORD`, PostgreSQL 암호 파일 또는 암호화된 예약 백업 자격 증명을 사용한다.

## CI

`.github/workflows/verify.yml`은 Pull Request 및 기본 브랜치 반영 시 Java 21 백엔드 테스트, Node 24 프런트 빌드, Playwright 테스트 수집을 자동 실행한다. 실제 로그인 E2E는 운영 자격 증명을 저장하지 않기 위해 로컬 또는 별도 보안 CI 환경에서 실행한다.
