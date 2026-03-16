#!/usr/bin/env python3
import json, subprocess, urllib.request, time, sys, re
from html.parser import HTMLParser

OPENROUTER_KEY = open('/root/openrouter-key').read().strip()

LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 40

class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.texts = []
        self.skip = False
        self.skip_tags = {'script', 'style', 'nav', 'header', 'footer', 'aside'}
    def handle_starttag(self, tag, attrs):
        if tag in self.skip_tags:
            self.skip = True
    def handle_endtag(self, tag):
        if tag in self.skip_tags:
            self.skip = False
    def handle_data(self, data):
        if not self.skip:
            t = data.strip()
            if t:
                self.texts.append(t)

def fetch_article_text(url, timeout=10):
    """Fetch article URL and extract text content."""
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)'
        })
        resp = urllib.request.urlopen(req, timeout=timeout)
        html = resp.read().decode('utf-8', errors='ignore')

        body_match = re.search(r'<article[^>]*>(.*?)</article>', html, re.DOTALL)
        if not body_match:
            body_match = re.search(r'class="article[_-]?body[^"]*"[^>]*>(.*?)</div>', html, re.DOTALL)
        if not body_match:
            body_match = re.search(r'class="story[_-]?body[^"]*"[^>]*>(.*?)</div>', html, re.DOTALL)
        if not body_match:
            body_match = re.search(r'class="comp_article[^"]*"[^>]*>(.*?)</div>', html, re.DOTALL)

        content = body_match.group(1) if body_match else html

        parser = TextExtractor()
        parser.feed(content)
        text = ' '.join(parser.texts)
        text = re.sub(r'\s+', ' ', text).strip()

        if len(text) > 2000:
            text = text[:2000] + '...'

        return text if len(text) > 50 else None
    except Exception as e:
        print(f"    [fetch] Failed: {e}")
        return None

# Get unsummarized articles from DB
result = subprocess.run(
    ['docker', 'exec', 'supabase-db', 'psql', '-U', 'postgres', '-d', 'postgres',
     '-t', '-A', '-F', '\t', '-c',
     f"SELECT id, title, source, category, source_url FROM articles WHERE summary IS NULL AND title IS NOT NULL ORDER BY published_at DESC LIMIT {LIMIT};"],
    capture_output=True, text=True
)

lines = [l.strip() for l in result.stdout.strip().split('\n') if l.strip()]
print(f"Found {len(lines)} articles to summarize")

success = 0
deleted = 0
for i, line in enumerate(lines):
    parts = line.split('\t')
    if len(parts) < 5:
        continue

    aid, title, source, category, source_url = parts[0], parts[1], parts[2], parts[3], parts[4]

    # Fetch article content
    article_text = fetch_article_text(source_url)

    # Check if English title
    korean_chars = sum(1 for c in title if '\uAC00' <= c <= '\uD7A3')
    is_english = korean_chars == 0 and len(title.strip()) > 3

    # Skip articles without body content - delete them
    if not article_text:
        subprocess.run(
            ['docker', 'exec', 'supabase-db', 'psql', '-U', 'postgres', '-d', 'postgres', '-c',
             f"DELETE FROM articles WHERE id = '{aid}';"],
            capture_output=True, text=True
        )
        deleted += 1
        print(f"  [{i+1}/{len(lines)}] DELETED (본문없음): {title[:60]}")
        continue

    prompt = '당신은 뉴스 기사를 간결하게 요약하는 전문가입니다.\n\n'
    prompt += '절대 규칙:\n'
    prompt += '- 기사 본문에 나온 내용만 요약할 것. 본문에 없는 정보를 추가하거나 추측하지 말 것\n'
    prompt += '- 인물 이름은 본문에 나온 그대로 사용할 것. 한자 이름을 임의로 해석하지 말 것\n'
    prompt += '- 李대통령, 尹대통령 등 한자 약칭은 본문 맥락에서 확인된 이름만 사용할 것\n\n'

    if is_english:
        prompt += '이 기사는 영어 기사입니다. 반드시 전체를 한국어로 번역하여 요약하세요.\n'
        prompt += '첫 번째 줄: 📌 제목을 자연스러운 한국어로 번역 (예: 📌 오픈AI, 새 모델 발표)\n'
        prompt += '(빈 줄)\n'
        prompt += '두 번째 줄부터 아래 규칙으로 한국어 요약:\n\n'

    prompt += '요약 형식 규칙:\n'
    prompt += '1. 5~8문장으로 요약할 것 (충분히 상세하게)\n'
    prompt += '2. 각 불릿(•) 문장 사이에 빈 줄을 넣어 가독성을 높일 것\n'
    prompt += '3. 문장 앞에 불릿(•)을 붙일 것\n'
    prompt += '4. 어려운 용어는 괄호 안에 쉬운 설명을 추가할 것\n'
    prompt += '5. 마지막 문장은 시사점 또는 결론으로 마무리\n'
    prompt += '6. 출력은 요약 내용만, 추가 설명이나 사족 없이\n\n'
    prompt += '출력 예시:\n'
    prompt += '• 첫 번째 핵심 내용을 설명하는 문장.\n'
    prompt += '\n'
    prompt += '• 두 번째 핵심 내용을 설명하는 문장.\n'
    prompt += '\n'
    prompt += '• 세 번째 핵심 내용을 설명하는 문장.\n\n'
    prompt += f'기사 제목: {title}\n'
    prompt += f'출처: {source}\n'
    prompt += f'카테고리: {category}\n\n'
    prompt += f'기사 본문:\n{article_text}'

    body = json.dumps({
        'model': 'anthropic/claude-haiku-4-5',
        'max_tokens': 800,
        'messages': [{'role': 'user', 'content': prompt}]
    }).encode()

    req = urllib.request.Request(
        'https://openrouter.ai/api/v1/chat/completions',
        data=body,
        headers={
            'Authorization': f'Bearer {OPENROUTER_KEY}',
            'Content-Type': 'application/json'
        }
    )

    try:
        resp = urllib.request.urlopen(req, timeout=30)
        data = json.loads(resp.read())
        summary = data['choices'][0]['message']['content'].strip()

        # Validate: if English title, summary must start with 📌
        if is_english and not summary.startswith('📌'):
            # Delete article that couldn't be translated
            subprocess.run(
                ['docker', 'exec', 'supabase-db', 'psql', '-U', 'postgres', '-d', 'postgres', '-c',
                 f"DELETE FROM articles WHERE id = '{aid}';"],
                capture_output=True, text=True
            )
            deleted += 1
            print(f"  [{i+1}/{len(lines)}] DELETED (번역실패): {title[:60]}")
            continue

        # Save to DB
        safe_summary = summary.replace("'", "''")
        subprocess.run(
            ['docker', 'exec', 'supabase-db', 'psql', '-U', 'postgres', '-d', 'postgres', '-c',
             f"UPDATE articles SET summary = '{safe_summary}', updated_at = NOW() WHERE id = '{aid}';"],
            capture_output=True, text=True
        )
        success += 1
        print(f"  [{i+1}/{len(lines)}] OK: {title[:60]}")
    except Exception as e:
        print(f"  [{i+1}/{len(lines)}] FAIL: {title[:50]} - {e}")

    time.sleep(0.5)

print(f"\nDone: {success} summarized, {deleted} deleted, out of {len(lines)}")
