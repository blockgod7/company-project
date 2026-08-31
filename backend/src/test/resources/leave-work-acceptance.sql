\getenv qa_password QA_APP_PASSWORD
BEGIN;
DO $guard$
BEGIN
    IF current_database() <> 'groupware_leave_work_qa' THEN
        RAISE EXCEPTION 'Fixtures require the isolated groupware_leave_work_qa database';
    END IF;
END $guard$;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
INSERT INTO dept(dept_code,dept_name,sort_order) VALUES ('QA_LEAVE_WORK','검증 전용 부서',999),('QA_OTHER','검증 다른 부서',999);
INSERT INTO emp(emp_id,emp_no,login_id,password_hash,emp_name,dept_id,role_code,position_name,work_category,hire_date,manager_emp_id,password_changed_at)
VALUES
(120005,'QA_ADMIN','qa.admin',crypt(:'qa_password',gen_salt('bf')),'검증 관리자',(SELECT dept_id FROM dept WHERE dept_code='QA_LEAVE_WORK'),'ADMIN','관리자','MANAGEMENT','2020-01-01',NULL,NOW()),
(120002,'QA_APPROVER','qa.approver',crypt(:'qa_password',gen_salt('bf')),'검증 결재자',(SELECT dept_id FROM dept WHERE dept_code='QA_LEAVE_WORK'),'USER','과장','MANAGEMENT','2020-01-01',NULL,NOW()),
(120001,'QA_WORKER','qa.worker',crypt(:'qa_password',gen_salt('bf')),'검증 신청자',(SELECT dept_id FROM dept WHERE dept_code='QA_LEAVE_WORK'),'USER','사원','FIELD','2020-01-01',120002,NOW()),
(120003,'QA_DELEGATE','qa.delegate',crypt(:'qa_password',gen_salt('bf')),'검증 대리신청자',(SELECT dept_id FROM dept WHERE dept_code='QA_LEAVE_WORK'),'USER','반장','FIELD','2020-01-01',120002,NOW()),
(120004,'QA_OUTSIDER','qa.outsider',crypt(:'qa_password',gen_salt('bf')),'검증 다른부서',(SELECT dept_id FROM dept WHERE dept_code='QA_OTHER'),'USER','사원','FIELD','2020-01-01',120002,NOW());
INSERT INTO emp_permission(emp_id,permission_code,reason) VALUES(120003,'WORK_REQUEST_DELEGATE','격리 검증 전용');
INSERT INTO emp_annual_leave(emp_id,leave_year,granted_days,adjustment_days,manual_used_days,reset_at,auto_calculated_days,final_days,calculation_mode,confirmation_status)
SELECT emp_id,2026,22,0,0,NOW(),22,22,'MANUAL','CONFIRMED' FROM emp WHERE emp_no LIKE 'QA_%';
COMMIT;
