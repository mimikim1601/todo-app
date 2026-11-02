<!-- Created: 2026-11-02 15:35 -->

# 오늘의 할 일

순수 HTML, CSS, JavaScript로 만든 개인용 할 일 관리 웹앱입니다. 프레임워크, 빌드 도구, 외부 라이브러리 없이 동작합니다.

## 배포 주소

- 기본 버전: https://mimikim1601.github.io/todo-app/
- 데스크톱 전체 화면 버전: https://mimikim1601.github.io/todo-app/web_version/
- 저장소: https://github.com/mimikim1601/todo-app

## 수정 후 다시 배포하는 방법

GitHub Pages가 main 브랜치를 자동으로 배포하므로, 고친 뒤 커밋하고 push만 하면 됩니다(반영까지 1~3분 정도 걸릴 수 있어요).

```bash
git add -A
git commit -m "무엇을 고쳤는지 짧게"
git push
```

## 실행 방법

`index.html`을 더블클릭해서 브라우저로 열면 됩니다. 설치나 서버, 인터넷 연결이 필요 없습니다.

## 기능

- **추가**: 입력창에 쓰고 Enter 또는 추가 버튼. 최대 100자, 공백만 입력하면 등록되지 않습니다.
- **수정**: 내용 더블클릭 또는 수정 버튼. Enter 저장, Esc 취소, 바깥을 누르면 저장.
- **삭제**: 삭제 버튼으로 바로 제거.
- **완료 체크**: 체크박스로 완료/미완료 전환. 완료 항목은 목록 아래로 내려갑니다.
- **카테고리**: 기본은 업무/개인/공부. "카테고리 편집"에서 추가·이름 바꾸기·삭제할 수 있습니다(최대 5개, 최소 1개). 카테고리를 지우면 그 안의 할 일도 함께 지워집니다(지우기 전에 확인).
- **필터**: 전체 + 카테고리 탭. 선택한 탭을 기억합니다.
- **진행률**: 전체와 카테고리별 "완료 수 / 전체 수 (%)"와 진행 막대.
- **자동 저장**: 모든 변경이 바로 저장되어 새로고침해도 유지됩니다.
- **키보드 사용**: Tab, Enter, Space, Esc만으로 모든 기능을 쓸 수 있습니다.

## 데이터 저장 위치

브라우저의 localStorage에 `todo-app:v1` 키로 저장됩니다. 데이터는 해당 브라우저에만 남으며, 다른 브라우저나 기기와 공유되지 않습니다. 브라우저 사이트 데이터를 지우면 할 일도 함께 지워집니다.

```json
{
  "todos": [
    { "id": "…", "text": "…", "category": "work", "completed": false, "createdAt": 0 }
  ],
  "settings": { "filter": "all", "lastCategory": "work", "theme": "day" },
  "categories": [
    { "id": "work", "name": "업무", "slot": "work" }
  ]
}
```

localStorage를 쓸 수 없는 환경에서는 화면 상단에 안내가 뜨고, 새로고침 전까지만 메모리에 유지됩니다.

## 파일 구성

- `index.html`: 화면 구조
- `style.css`: 스타일
- `app.js`: 동작
- `images/`: 아이콘 PNG (카테고리 자리 순서: 업무 hare · 개인 chiikawa · 공부 usagi · 새 카테고리 shisha → me)
- `fonts/`: Jua · Baloo 2 폰트와 라이선스
