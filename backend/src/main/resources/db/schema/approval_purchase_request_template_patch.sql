-- Refreshes the PURCHASE approval template to the purchase request v1 layout.

UPDATE approval_template
SET
    template_name = '구매요구서',
    description = '구매 품목, 요구일, BU 비용분할을 작성하는 구매요구서',
    fields_json = '[
      {"name":"requiredDate","label":"요구일","type":"date","required":true},
      {"name":"purchaseItemsJson","label":"품목 내역","type":"table","required":true},
      {"name":"buSplit","label":"BU 비용분할","type":"percent-split","required":true},
      {"name":"deliveryDate","label":"입고일","type":"date"}
    ]',
    print_layout_json = '{"layout":"purchase-request","sections":["meta","items","buSplit","approvalLines","attachments"]}',
    active_yn = 'Y',
    sort_order = 40,
    updated_at = NOW()
WHERE template_code = 'PURCHASE'
  AND version = (
      SELECT latest.version
      FROM (
          SELECT MAX(version) AS version
          FROM approval_template
          WHERE template_code = 'PURCHASE'
      ) latest
  );
