UPDATE board
SET board_name = '게시판',
    use_yn = 'Y'
WHERE board_code = 'GENERAL';

UPDATE board
SET use_yn = 'N'
WHERE board_code <> 'GENERAL';
