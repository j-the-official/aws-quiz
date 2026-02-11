# AWS 認證模擬考系統

一個簡潔、現代化的 AWS 認證考試練習平台，支援多種 AWS 認證考試，提供完整的題庫管理和學習追蹤功能。

##  功能特色

-  **多認證支援** - 支援 AWS 全系列認證考試（Foundational、Associate、Professional、Specialty）
-  **類別篩選** - 可依據不同知識領域進行分類練習
-  **選項隨機** - 每次測驗選項順序隨機，避免記憶答案位置
-  **錯題本** - 自動收集錯題，可針對弱點重複練習
-  **學習追蹤** - 記錄答題歷史，追蹤各類別正確率
-  **深色模式** - 支援亮色/深色主題切換
-  **響應式設計** - 完美支援手機、平板、桌面裝置
-  **純前端** - 無需後端，可直接部署到靜態網站託管服務

##  快速開始

### 本地運行

1. Clone 本專案
```bash
git clone https://github.com/你的用戶名/aws-quiz.git
cd aws-quiz
```

2. 準備題庫文件（見下方「題庫格式」說明）

3. 使用任意 HTTP 服務器運行

4. 開啟瀏覽器訪問 `http://localhost:8000`

##  題庫格式

題庫文件需放置在專案根目錄，命名格式為 `questions-{exam-id}.json`。

### 單選題格式

```json
[
  {
    "category": "運算",
    "question": "哪個 AWS 服務最適合運行無狀態的容器化應用程式？",
    "options": [
      "Amazon EC2",
      "AWS Fargate",
      "AWS Lambda",
      "Amazon Lightsail"
    ],
    "answer": 1,
    "explanation": "AWS Fargate 是無伺服器運算引擎，專為容器設計，無需管理伺服器。"
  }
]
```

### 多選題格式

```json
[
  {
    "category": "安全性",
    "question": "以下哪些是 AWS 共享責任模型中客戶的責任？（選擇兩項）",
    "options": [
      "資料中心的實體安全",
      "應用程式層級的存取控制",
      "作業系統的修補程式",
      "AWS 全球基礎設施的維護"
    ],
    "answer": [1, 2],
    "explanation": "客戶負責應用程式層級安全和 OS 修補，AWS 負責基礎設施。"
  }
]
```

### 欄位說明

- `category` (string) - 題目類別（如：運算、儲存、安全性等）
- `question` (string) - 題目內容
- `options` (array) - 選項陣列，通常為 4 個選項
- `answer` (number | array) - 單選題為索引數字（0-3），多選題為索引陣列
- `explanation` (string) - 答案解析

## 技術棧

- **純 JavaScript** - 無框架依賴
- **現代 CSS** - CSS Variables 支援主題切換
- **localStorage** - 本地資料持久化
- **Responsive Design** - Mobile-first 設計

##  專案結構

```
aws-quiz/
├── index.html              # 主頁面
├── app.js                  # 核心邏輯
├── style.css              # 樣式表
├── questions-*.json       # 題庫文件（不包含在 repo 中）
├── .gitignore            # Git 忽略文件
└── README.md             # 說明文件
```

##  授權

MIT License

---

**免責聲明**: 本專案為學習工具，與 AWS 官方無關聯。
