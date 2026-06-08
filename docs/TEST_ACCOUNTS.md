# PingMe Test Accounts

Thong tin account test nam o:

- Script tao/upsert account: `server/scripts/seed-test-users.js`
- MongoDB collection sau khi seed: `users`
- Password chung cho tat ca account seed: `123456`

Chay lai seed bat cu luc nao:

```bash
cd server
npm run seed:test-users
```

Script dung `upsert`, nen chay lai se cap nhat account cu thay vi tao trung.

Quan he sau khi seed:

- `Friend with real accounts`: 10 account moi se nam trong friend list cua cac account that hien co.
- `Stranger to real accounts`: 10 account moi khong nam trong friend list cua cac account that, nhung la ban cua nhom `Friend with real accounts` de test friend-of-friend suggestions.
- `Legacy group account`: 4 account seed cu van giu trong DB de test group/conversation cu, nhung khong tu dong add vao friend list cua account that.
- Automation/local test account ngoai danh sach nay, vi du `E2E*`, khong duoc noi vao graph goi y.

## Friend With Real Accounts

| # | Username | Email | Password |
|---|---|---|---|
| 1 | Bao Tran | bao.tran.test@pingme.local | 123456 |
| 2 | Ngoc Linh | ngoc.linh.test@pingme.local | 123456 |
| 3 | Quang Huy | quang.huy.test@pingme.local | 123456 |
| 4 | Mai Phuong | mai.phuong.test@pingme.local | 123456 |
| 5 | Gia Han | gia.han.test@pingme.local | 123456 |
| 6 | Duc Anh | duc.anh.test@pingme.local | 123456 |
| 7 | Khanh Vy | khanh.vy.test@pingme.local | 123456 |
| 8 | Nhat Minh | nhat.minh.test@pingme.local | 123456 |
| 9 | Thanh Tam | thanh.tam.test@pingme.local | 123456 |
| 10 | Phuong Thao | phuong.thao.test@pingme.local | 123456 |

## Stranger To Real Accounts

| # | Username | Email | Password |
|---|---|---|---|
| 1 | Trung Kien | trung.kien.test@pingme.local | 123456 |
| 2 | Hai Dang | hai.dang.test@pingme.local | 123456 |
| 3 | Linh Chi | linh.chi.test@pingme.local | 123456 |
| 4 | Tuan Kiet | tuan.kiet.test@pingme.local | 123456 |
| 5 | An Nhien | an.nhien.test@pingme.local | 123456 |
| 6 | Viet Hoang | viet.hoang.test@pingme.local | 123456 |
| 7 | My Duyen | my.duyen.test@pingme.local | 123456 |
| 8 | Quynh Nhu | quynh.nhu.test@pingme.local | 123456 |
| 9 | Dang Khoa | dang.khoa.test@pingme.local | 123456 |
| 10 | Bich Ngoc | bich.ngoc.test@pingme.local | 123456 |

## Legacy Group Accounts

| # | Username | Email | Password |
|---|---|---|---|
| 1 | Lan Anh | lan.anh.test@pingme.local | 123456 |
| 2 | Minh Quan | minh.quan.test@pingme.local | 123456 |
| 3 | Thu Ha | thu.ha.test@pingme.local | 123456 |
| 4 | Hoang Nam | hoang.nam.test@pingme.local | 123456 |
