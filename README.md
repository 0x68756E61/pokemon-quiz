# pokemon-quiz

포켓몬 이름을 보고 알맞은 이미지를 고르는 모바일 친화형 퀴즈입니다.

## 기능

- 총 10문제 진행
- 문제당 10초 제한시간
- 이름 1개 + 이미지 3개 보기
- 정답/오답/시간초과 효과음
- 최종 점수 표시
- GitHub Pages 자동 배포

## 로컬 실행

```bash
cd /home/ubuntu/workspace/pokemon-quiz
python3 -m http.server 4173
```

브라우저에서 아래 주소를 열면 됩니다.

```text
http://localhost:4173
```

## 배포

`main` 브랜치에 push 하면 GitHub Actions가 자동으로 GitHub Pages에 배포합니다.

예상 배포 주소:

```text
https://0x68756E61.github.io/pokemon-quiz/
```

## GitHub Pages 설정

GitHub 저장소에서 **Settings → Pages → Build and deployment** 항목이
**GitHub Actions** 로 설정되어 있어야 합니다.
