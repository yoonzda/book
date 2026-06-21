const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// --- 날짜 포맷팅 도우미 함수 ---
const formatProjectDate = (proj) => {
    const start = proj.startDate || '';
    const end = proj.endDate || '';
    const mode = proj.dateDisplayMode || 'period';

    const formatDots = (str) => {
        if (!str) return '';
        return str.replace(/-/g, '.');
    };

    if (mode === 'period') {
        const formattedStart = formatDots(start);
        const formattedEnd = (end.toLowerCase() === 'ongoing' || end === '진행 중' || !end)
            ? 'ONGOING'
            : formatDots(end);
        return `${formattedStart} - ${formattedEnd}`;
    } else if (mode === 'ongoing') {
        return `${formatDots(start)} ~`;
    } else {
        const targetDate = (end && end !== '진행 중' && end.toLowerCase() !== 'ongoing') ? end : start;
        if (!targetDate) return '';
        const separator = targetDate.includes('.') ? '.' : '-';
        const parts = targetDate.split(separator);
        if (parts.length >= 2) {
            return `${parts[0]}.${parts[1]}`;
        }
        return formatDots(targetDate);
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
            const formattedDate = formatProjectDate(proj);
            projectsListMarkup += `
            <section class="project-section" id="section-${proj.id}">
                <div class="grid-container project-card-container">
                    <div class="project-card-body">
                        <span class="project-category">NO. ${num}</span>
                        <div class="reveal-wrapper">
                            <h2 class="project-title reveal-inner">
                                <a href="projects/${proj.id}.html" class="project-link" data-image="${proj.imageUrl}">${proj.title}</a>
                            </h2>
                        </div>
                        <p class="project-desc project-card-desc">${proj.description}</p>
                    </div>
                    <footer class="project-footer project-card-footer">
                        <div class="project-meta-group" style="display: flex; gap: 2rem;">
                            <span class="project-meta-item"><span class="project-meta-label">PERIOD</span>${formattedDate}</span>
                            <span class="project-meta-item"><span class="project-meta-label">CONTRIBUTION</span>${proj.contribution || '100%'}</span>
                        </div>
                        <div class="project-actions-group">
                            ${proj.link ? `
                            <a href="${proj.link}" target="_blank" class="btn-brutal btn-live-site">
                                <span>사이트 이동</span>
                                <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
                            </a>` : ''}
                            <a href="projects/${proj.id}.html" class="btn-brutal btn-detail-view project-link" data-image="${proj.imageUrl}">
                                <span>상세내용</span>
                                <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </a>
                        </div>
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

    projects.forEach((proj, idx) => {
        const num = String(idx + 1).padStart(2, '0');
        const formattedDate = formatProjectDate(proj);
        const categoryMetaHtml = proj.category ? `
                        <div>
                            <span class="project-meta-label project-meta-sublabel">CATEGORY</span>
                            <span class="project-meta-value">${proj.category}</span>
                        </div>` : '';
        let html = projectTemplate
            .replace(/{{TITLE}}/g, proj.title)
            .replace(/{{PROJECT_NUM}}/g, num)
            .replace(/{{CATEGORY_META_HTML}}/g, categoryMetaHtml)
            .replace(/{{DESCRIPTION}}/g, proj.description)
            .replace(/{{IMAGE}}/g, proj.imageUrl.startsWith('http') || proj.imageUrl.startsWith('/') ? proj.imageUrl : `../${proj.imageUrl}`)
            .replace(/{{PERIOD}}/g, formattedDate)
            .replace(/{{CONTRIBUTION}}/g, proj.contribution || '100%')
            .replace(/{{ROLE}}/g, proj.role || 'Personal')
            .replace(/{{TECH_STACK}}/g, proj.techStack || 'None')
            .replace(/{{LINK}}/g, proj.link || '#');
        
        fs.writeFileSync(path.join(projectsDir, `${proj.id}.html`), html, 'utf8');
    });
    console.log(`개별 프로젝트 상세 페이지 컴파일 완료 (${projects.length}개)`);
};

// --- API 엔드포인트 ---

// 1. 프로젝트 목록 조회
app.get('/api/projects', (req, res) => {
    const projects = readProjectsData();
    res.json(projects);
});

// 2. 프로젝트 추가
app.post('/api/projects', (req, res) => {
    const { title, category, description, imageUrl, startDate, endDate, dateDisplayMode, contribution, role, techStack, link } = req.body;

    if (!title || !description || !imageUrl || !startDate || !dateDisplayMode || !contribution || !role || !techStack) {
        return res.status(400).json({ success: false, message: '필수 필드가 누락되었습니다.' });
    }

    const projects = readProjectsData();
    const newProject = {
        id: `project_${Date.now()}`,
        title,
        category: category || '',
        description,
        imageUrl,
        startDate,
        endDate: endDate || '',
        dateDisplayMode,
        contribution,
        role,
        techStack,
        link: link || ''
    };

    projects.push(newProject);
    if (writeProjectsData(projects)) {
        compileStaticPages();
        return res.status(201).json({ success: true, project: newProject });
    } else {
        return res.status(500).json({ success: false, message: '데이터베이스 저장 실패' });
    }
});

// 3. 프로젝트 수정
app.put('/api/projects/:id', (req, res) => {
    const { id } = req.params;
    const { title, category, description, imageUrl, startDate, endDate, dateDisplayMode, contribution, role, techStack, link } = req.body;

    if (!title || !description || !imageUrl || !startDate || !dateDisplayMode || !contribution || !role || !techStack) {
        return res.status(400).json({ success: false, message: '필수 필드가 누락되었습니다.' });
    }

    let projects = readProjectsData();
    const index = projects.findIndex(p => p.id === id);

    if (index === -1) {
        return res.status(404).json({ success: false, message: '해당 프로젝트를 찾을 수 없습니다.' });
    }

    projects[index] = {
        ...projects[index],
        title,
        category: category || '',
        description,
        imageUrl,
        startDate,
        endDate: endDate || '',
        dateDisplayMode,
        contribution,
        role,
        techStack,
        link: link || ''
    };

    if (writeProjectsData(projects)) {
        compileStaticPages();
        return res.json({ success: true, project: projects[index] });
    } else {
        return res.status(500).json({ success: false, message: '데이터베이스 업데이트 실패' });
    }
});

// 4. 프로젝트 삭제
app.delete('/api/projects/:id', (req, res) => {
    const { id } = req.params;
    let projects = readProjectsData();
    const originalLength = projects.length;

    projects = projects.filter(p => p.id !== id);

    if (projects.length === originalLength) {
        return res.status(404).json({ success: false, message: '해당 프로젝트를 찾을 수 없습니다.' });
    }

    if (writeProjectsData(projects)) {
        compileStaticPages();
        return res.json({ success: true, message: '삭제 완료' });
    } else {
        return res.status(500).json({ success: false, message: '데이터베이스 업데이트 실패' });
    }
});

// 5. 프로젝트 순서 변경
app.post('/api/projects/reorder', (req, res) => {
    const { order } = req.body;
    if (!order || !Array.isArray(order)) {
        return res.status(400).json({ success: false, message: '올바르지 않은 순서 데이터입니다.' });
    }

    const projects = readProjectsData();
    const sortedProjects = [];
    order.forEach(id => {
        const proj = projects.find(p => p.id === id);
        if (proj) {
            sortedProjects.push(proj);
        }
    });

    // 만약 누락된 프로젝트가 있다면 누락 방지를 위해 뒤에 추가
    projects.forEach(proj => {
        if (!sortedProjects.some(p => p.id === proj.id)) {
            sortedProjects.push(proj);
        }
    });

    if (writeProjectsData(sortedProjects)) {
        compileStaticPages();
        return res.json({ success: true, message: '순서 변경 완료' });
    } else {
        return res.status(500).json({ success: false, message: '데이터베이스 저장 실패' });
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
