const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
        if (end.toLowerCase() === 'ongoing' || end === '진행 중' || !end) {
            return `${formattedStart} ~`;
        }
        return `${formattedStart} - ${formatDots(end)}`;
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

// --- Base64 이미지 파일 저장 도우미 함수 ---
const saveBase64Image = (base64Str) => {
    if (!base64Str) return '';
    // 만약 이미 로컬 파일 경로이거나 외부 URL인 경우 그대로 반환
    if (!base64Str.startsWith('data:image')) {
        return base64Str;
    }
    
    try {
        const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            throw new Error('올바르지 않은 base64 형식입니다.');
        }
        
        const ext = matches[1].split('/')[1] || 'png';
        const buffer = Buffer.from(matches[2], 'base64');
        
        // uploads 폴더 보장
        const uploadsDir = path.join(__dirname, 'images', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        const fileName = `upload_${Date.now()}.${ext}`;
        const filePath = path.join(uploadsDir, fileName);
        fs.writeFileSync(filePath, buffer);
        
        return `images/uploads/${fileName}`;
    } catch (err) {
        console.error('Base64 이미지 저장 에러:', err);
        return base64Str;
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
                        <p class="project-desc project-card-desc">${proj.subtitle || proj.description || ''}</p>
                    </div>
                    <footer class="project-footer project-card-footer">
                        <div></div>
                        <div class="footer-right-column" style="display: flex; flex-direction: column; align-items: flex-end; gap: 1rem;">
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
                            <div class="project-meta-group" style="display: flex; gap: 2rem;">
                                <span class="project-meta-item"><span class="project-meta-label">PERIOD</span>${formattedDate}</span>
                                <span class="project-meta-item"><span class="project-meta-label">CONTRIBUTION</span>${proj.contribution || '100%'}</span>
                            </div>
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
        
        // 1. 프로젝트 분류 (Type) 렌더링
        const projectTypeHtml = proj.projectType ? `
                        <div>
                            <span class="project-meta-label project-meta-sublabel">TYPE</span>
                            <span class="project-meta-value">${proj.projectType}</span>
                        </div>` : '';

        // 2. 통합 링크 버튼군 렌더링 (SVG 로고 포함)
        let linksHtml = '';
        if (proj.link) {
            linksHtml += `
            <a href="${proj.link}" target="_blank" class="btn-brutal-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
                <span>사이트 이동</span>
            </a>`;
        }
        if (proj.githubLink) {
            linksHtml += `
            <a href="${proj.githubLink}" target="_blank" class="btn-brutal-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                <span>GITHUB 보기</span>
            </a>`;
        }
        if (proj.figmaLink) {
            linksHtml += `
            <a href="${proj.figmaLink}" target="_blank" class="btn-brutal-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z"></path><path d="M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z"></path><path d="M12 9h3.5a3.5 3.5 0 1 1-3.5 3.5V9z"></path><path d="M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z"></path><path d="M5 18.5A3.5 3.5 0 0 1 8.5 15H12v3.5a3.5 3.5 0 1 1-7 0z"></path></svg>
                <span>FIGMA 보기</span>
            </a>`;
        }
        if (proj.notionLink) {
            linksHtml += `
            <a href="${proj.notionLink}" target="_blank" class="btn-brutal-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><path d="M7 7h3l5 10V7h2M7 17v-3m10 3v-3"></path></svg>
                <span>NOTION 보기</span>
            </a>`;
        }

        // 3. 문제 해결 및 성과 (Troubleshooting) 렌더링
        const troubleshootingHtml = proj.troubleshooting ? `
                        <div class="project-troubleshooting-section" style="margin-top: 3rem; border-top: var(--border-stroke); padding-top: 2rem;">
                            <span class="project-meta-label project-meta-sublabel">TROUBLESHOOTING & IMPACT</span>
                            <p class="project-desc" style="white-space: pre-wrap; font-size: 1.05rem; line-height: 1.8; margin-top: 0.5rem; max-width: 100%;">${proj.troubleshooting}</p>
                        </div>` : '';

        let html = projectTemplate
            .replace(/{{TITLE}}/g, proj.title)
            .replace(/{{PROJECT_NUM}}/g, num)
            .replace(/{{PROJECT_TYPE_HTML}}/g, projectTypeHtml)
            .replace(/{{DESCRIPTION}}/g, proj.description)
            .replace(/{{IMAGE}}/g, proj.imageUrl.startsWith('http') || proj.imageUrl.startsWith('/') ? proj.imageUrl : `../${proj.imageUrl}`)
            .replace(/{{PERIOD}}/g, formattedDate)
            .replace(/{{CONTRIBUTION}}/g, proj.contribution || '100%')
            .replace(/{{ROLE}}/g, proj.role || 'Personal')
            .replace(/{{TECH_STACK}}/g, proj.techStack || 'None')
            .replace(/{{LINKS_HTML}}/g, linksHtml)
            .replace(/{{TROUBLESHOOTING_HTML}}/g, troubleshootingHtml);
        
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
    const { 
        title, 
        category, 
        description, 
        imageUrl, 
        startDate, 
        endDate, 
        dateDisplayMode, 
        contribution, 
        role, 
        techStack, 
        link,
        projectType,
        githubLink,
        figmaLink,
        notionLink,
        subtitle,
        troubleshooting
    } = req.body;

    const isDateProvided = (dateDisplayMode === 'single') ? !!endDate : !!startDate;
    if (!title || !description || !imageUrl || !dateDisplayMode || !isDateProvided || !contribution || !role || !techStack || !projectType || !subtitle) {
        return res.status(400).json({ success: false, message: '필수 필드가 누락되었습니다.' });
    }

    const projects = readProjectsData();
    const savedImageUrl = saveBase64Image(imageUrl);
    const newProject = {
        id: `project_${Date.now()}`,
        title,
        category: category || '',
        description,
        imageUrl: savedImageUrl,
        startDate,
        endDate: endDate || '',
        dateDisplayMode,
        contribution,
        role,
        techStack,
        link: link || '',
        projectType,
        githubLink: githubLink || '',
        figmaLink: figmaLink || '',
        notionLink: notionLink || '',
        subtitle,
        troubleshooting: troubleshooting || ''
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
    const { 
        title, 
        category, 
        description, 
        imageUrl, 
        startDate, 
        endDate, 
        dateDisplayMode, 
        contribution, 
        role, 
        techStack, 
        link,
        projectType,
        githubLink,
        figmaLink,
        notionLink,
        subtitle,
        troubleshooting
    } = req.body;

    const isDateProvided = (dateDisplayMode === 'single') ? !!endDate : !!startDate;
    if (!title || !description || !imageUrl || !dateDisplayMode || !isDateProvided || !contribution || !role || !techStack || !projectType || !subtitle) {
        return res.status(400).json({ success: false, message: '필수 필드가 누락되었습니다.' });
    }

    let projects = readProjectsData();
    const index = projects.findIndex(p => p.id === id);

    if (index === -1) {
        return res.status(404).json({ success: false, message: '해당 프로젝트를 찾을 수 없습니다.' });
    }

    const savedImageUrl = saveBase64Image(imageUrl);
    projects[index] = {
        ...projects[index],
        title,
        category: category || '',
        description,
        imageUrl: savedImageUrl,
        startDate,
        endDate: endDate || '',
        dateDisplayMode,
        contribution,
        role,
        techStack,
        link: link || '',
        projectType,
        githubLink: githubLink || '',
        figmaLink: figmaLink || '',
        notionLink: notionLink || '',
        subtitle,
        troubleshooting: troubleshooting || ''
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
