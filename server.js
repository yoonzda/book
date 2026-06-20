const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';

// 암호화 SHA-256 해시 함수
const getHash = (text) => {
    return crypto.createHash('sha256').update(text).digest('hex');
};

const ADMIN_HASH = getHash(ADMIN_PASSWORD);

// 미들웨어 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 보안 검증 미들웨어
const authenticate = (req, res, next) => {
    const token = req.cookies.admin_token;
    if (token === ADMIN_HASH) {
        next();
    } else {
        res.status(401).json({ success: false, message: '인증되지 않은 사용자입니다.' });
    }
};

// 파일 도우미 함수들
const readProjectsData = () => {
    try {
        const filePath = path.join(__dirname, 'projects.json');
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify([]));
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('데이터 읽기 실패:', err);
        return [];
    }
};

const writeProjectsData = (data) => {
    try {
        const filePath = path.join(__dirname, 'projects.json');
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('데이터 쓰기 실패:', err);
        return false;
    }
};

// --- 정적 웹페이지 컴파일러 엔진 ---
const compileStaticPages = () => {
    const projects = readProjectsData();

    // 1. templates/index.template.html 읽기
    const indexTemplatePath = path.join(__dirname, 'templates', 'index.template.html');
    if (!fs.existsSync(indexTemplatePath)) {
        console.error('Index 템플릿 파일이 없습니다.');
        return;
    }
    let indexTemplate = fs.readFileSync(indexTemplatePath, 'utf8');

    // index.html 프로젝트 리스트 마크업 생성
    let projectsListMarkup = '';
    if (projects.length === 0) {
        projectsListMarkup = `
        <section class="project-section in-view" id="empty-state">
            <div></div>
            <div>
                <span class="project-category">PORTFOLIO IS EMPTY</span>
                <h2 class="project-title">아직 등록된<br>프로젝트가 없습니다.</h2>
                <p class="project-desc">list.html 페이지에서 새로운 프로젝트를 추가해 주세요.</p>
            </div>
            <div></div>
        </section>`;
    } else {
        projects.forEach((proj, idx) => {
            const num = String(idx + 1).padStart(2, '0');
            projectsListMarkup += `
            <section class="project-section" id="section-${proj.id}">
                <div class="grid-container project-card-container">
                    <header class="project-meta-header project-card-header">
                        <span class="project-meta-item"><span class="project-meta-label">NO.</span>${num}</span>
                        <span class="project-meta-item"><span class="project-meta-label">YEAR</span>${proj.year}</span>
                    </header>
                    <div class="project-card-body">
                        <span class="project-category">${proj.category}</span>
                        <div class="reveal-wrapper">
                            <h2 class="project-title reveal-inner">
                                <a href="projects/${proj.id}.html" class="project-link" data-image="${proj.imageUrl}">${proj.title}</a>
                            </h2>
                        </div>
                        <p class="project-desc project-card-desc">${proj.description}</p>
                    </div>
                    <footer class="project-footer project-card-footer">
                        <span class="project-meta-item"><span class="project-meta-label">CLIENT</span>${proj.client || 'Personal'}</span>
                        <a href="projects/${proj.id}.html" class="btn-brutal project-link" data-image="${proj.imageUrl}">VIEW PROJECT</a>
                    </footer>
                </div>
            </section>\n`;
        });
    }

    // index.html 작성
    const indexHtml = indexTemplate.replace('{{PROJECTS_LIST}}', projectsListMarkup);
    fs.writeFileSync(path.join(__dirname, 'index.html'), indexHtml, 'utf8');
    console.log('index.html 정적 컴파일 완료.');

    // 2. templates/project.template.html 읽기
    const projectTemplatePath = path.join(__dirname, 'templates', 'project.template.html');
    if (!fs.existsSync(projectTemplatePath)) {
        console.error('Project 템플릿 파일이 없습니다.');
        return;
    }
    const projectTemplate = fs.readFileSync(projectTemplatePath, 'utf8');

    // projects 폴더 생성 보장
    const projectsDir = path.join(__dirname, 'projects');
    if (!fs.existsSync(projectsDir)) {
        fs.mkdirSync(projectsDir);
    }

    // 기존 projects 디렉토리의 파일들과 동기화 (삭제된 프로젝트 정리)
    const activeProjectFiles = new Set(projects.map(p => `${p.id}.html`));
    try {
        const existingFiles = fs.readdirSync(projectsDir);
        existingFiles.forEach(file => {
            if (file.endsWith('.html') && !activeProjectFiles.has(file)) {
                fs.unlinkSync(path.join(projectsDir, file));
                console.log(`구식 정적 파일 삭제됨: projects/${file}`);
            }
        });
    } catch (err) {
        console.error('프로젝트 디렉토리 정리 오류:', err);
    }

    // 각 프로젝트별 개별 HTML 생성
    projects.forEach((proj) => {
        let html = projectTemplate
            .replace(/{{TITLE}}/g, proj.title)
            .replace(/{{CATEGORY}}/g, proj.category)
            .replace(/{{DESCRIPTION}}/g, proj.description)
            .replace(/{{IMAGE}}/g, proj.imageUrl)
            .replace(/{{YEAR}}/g, proj.year)
            .replace(/{{CLIENT}}/g, proj.client || 'Personal')
            .replace(/{{LINK}}/g, proj.link || '#');
        
        fs.writeFileSync(path.join(projectsDir, `${proj.id}.html`), html, 'utf8');
    });
    console.log(`개별 프로젝트 상세 페이지 컴파일 완료 (${projects.length}개)`);
};

// --- API 엔드포인트 ---

// 1. 관리자 비밀번호 검증 및 토큰 발급
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (!password) {
        return res.status(400).json({ success: false, message: '비밀번호를 입력해 주세요.' });
    }

    if (getHash(password) === ADMIN_HASH) {
        // 쿠키 보안 설정 (httpOnly 적용하여 JS 탈취 방지, 로컬용)
        res.cookie('admin_token', ADMIN_HASH, {
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000 // 1일
        });
        return res.json({ success: true, message: '인증 성공' });
    } else {
        return res.status(401).json({ success: false, message: '비밀번호가 일치하지 않습니다.' });
    }
});

// 2. 인증 상태 체크
app.get('/api/check-auth', (req, res) => {
    const token = req.cookies.admin_token;
    if (token === ADMIN_HASH) {
        return res.json({ authenticated: true });
    }
    return res.json({ authenticated: false });
});

// 3. 로그아웃
app.post('/api/logout', (req, res) => {
    res.clearCookie('admin_token');
    res.json({ success: true });
});

// 4. 프로젝트 목록 조회 (공개 API)
app.get('/api/projects', (req, res) => {
    const projects = readProjectsData();
    res.json(projects);
});

// 5. 프로젝트 추가 (보안 적용)
app.post('/api/projects', authenticate, (req, res) => {
    const { title, category, description, imageUrl, year, client, link } = req.body;

    if (!title || !category || !description || !imageUrl || !year) {
        return res.status(400).json({ success: false, message: '필수 필드가 누락되었습니다.' });
    }

    const projects = readProjectsData();
    const newProject = {
        id: `project_${Date.now()}`,
        title,
        category,
        description,
        imageUrl,
        year,
        client: client || '',
        link: link || ''
    };

    projects.push(newProject);
    if (writeProjectsData(projects)) {
        // 정적 HTML 재생성
        compileStaticPages();
        return res.status(201).json({ success: true, project: newProject });
    } else {
        return res.status(500).json({ success: false, message: '데이터베이스 저장 실패' });
    }
});

// 6. 프로젝트 삭제 (보안 적용)
app.delete('/api/projects/:id', authenticate, (req, res) => {
    const { id } = req.params;
    let projects = readProjectsData();
    const originalLength = projects.length;

    projects = projects.filter(p => p.id !== id);

    if (projects.length === originalLength) {
        return res.status(404).json({ success: false, message: '해당 프로젝트를 찾을 수 없습니다.' });
    }

    if (writeProjectsData(projects)) {
        // 정적 HTML 재생성
        compileStaticPages();
        return res.json({ success: true, message: '삭제 완료' });
    } else {
        return res.status(500).json({ success: false, message: '데이터베이스 업데이트 실패' });
    }
});

// 정적 자원 서빙
app.use(express.static(path.join(__dirname)));

// 서버 초기 구동 시 index.html 및 projects 컴파일 수행 (동기화 보장)
const initServer = () => {
    console.log('서버 초기화 중... 정적 파일 컴파일을 수행합니다.');
    const templatesDir = path.join(__dirname, 'templates');
    if (!fs.existsSync(templatesDir)) {
        fs.mkdirSync(templatesDir);
    }
    
    // 만약 초기 구동 시 템플릿 파일이 있다면 컴파일
    if (fs.existsSync(path.join(templatesDir, 'index.template.html'))) {
        compileStaticPages();
    } else {
        console.log('템플릿 파일이 발견되지 않아 초기 빌드를 생략합니다. 템플릿 작성 후 구동해 주세요.');
    }
};

app.listen(PORT, () => {
    console.log(`-----------------------------------------------------`);
    console.log(`로컬 개발 서버 구동 중: http://localhost:${PORT}`);
    console.log(`관리자 대시보드 주소: http://localhost:${PORT}/list.html`);
    console.log(`-----------------------------------------------------`);
    initServer();
});
