# 機台到工程師的資料流

一片晶圓在機台上被處理或量測時，資料會經過機台控制電腦、外掛的 Module / Compute Server、EAP、FDC、SPC、APC、MES 與資料平台，最後成為製程工程師 (PE) 儀表板上的一個點或一則警報。

下面的互動圖可以點選每個方塊或連線查看說明，也可以選擇情境，用「下一步」逐步播放資料流動的過程。

<div class="lab" data-lab="dataflow"></div>

## 為什麼要把運算拆到 Module / Compute Server

| 項目 | 機台控制電腦（IPC） | Module / Compute Server |
|---|---|---|
| 主要任務 | 即時控制、配方執行、安全互鎖、對外通訊 | 影像處理、光譜擬合、缺陷比對、機器學習推論 |
| 設計重點 | 穩定、確定性、反應時間可預期 | 大量平行運算（多核心 CPU、GPU、FPGA） |
| 對外網路 | 廠區網路（SECS/GEM、Interface A） | 通常只連機台私有網路，與廠區隔離 |
| 資料型態 | 事件、警報、量測結果數值 | 原始影像、光譜、缺陷影像（資料量大） |
| 故障影響 | 機台停機 | 量測或檢測無法完成，機台會報出運算相關警報 |

!!! note "說明"
    不同廠商對外掛運算單元的稱呼不同（Image Computer、Reconstruction Server、Compute Module 等），實際架構依機型而異；本頁以常見的量測與檢測機台為例說明概念。
