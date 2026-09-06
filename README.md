# 圖書館 360° 全景導覽

## 1. 這個專案是在做什麼的

這是一個使用 Vite 與 Photo Sphere Viewer 製作的圖書館 360° 全景導覽網頁。使用者可以在瀏覽器中拖曳觀看全景、切換 8 個拍攝地點，並在畫面中新增、修改或刪除書櫃介紹文字。介紹文字僅暫存在當次使用中，重新整理網頁後會清除。

## 2. 要怎麼安裝與啟動

以下以 Windows PowerShell 為例。先安裝 [Git](https://git-scm.com/downloads) 與 [Node.js](https://nodejs.org/)（22.x 需為 22.12 以上，或使用 24.x），安裝完成後重新開啟 PowerShell。

確認安裝成功：

```powershell
git --version
node --version
npm.cmd --version
```

下載專案並安裝套件（需要網路連線；私人儲存庫需登入有權限的 GitHub 帳號）：

```powershell
git clone https://github.com/ryan8252/library-360-viewer.git
cd library-360-viewer
npm.cmd ci
```

啟動網頁：

```powershell
npm.cmd run dev -- --host 127.0.0.1
```

使用瀏覽器開啟終端機顯示的網址，通常是 `http://127.0.0.1:5173`。使用期間保持終端機開啟，結束時按 `Ctrl+C`。

之後再次使用，只需在專案資料夾開啟 PowerShell，執行上述啟動指令，不需要重新安裝套件。
