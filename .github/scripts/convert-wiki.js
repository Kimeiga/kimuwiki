const fs = require('fs-extra');
const path = require('path');
const MarkdownIt = require('markdown-it');
const frontMatter = require('front-matter');

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
});

const WIKI_DIR = 'wiki';
const OUTPUT_DIR = '_site';
const TEMPLATE_PATH = '.github/templates/page.html';
// Get repository name from environment variable or default to 'kimuwiki'
const REPO_OWNER = process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/')[0] : 'kimusan';
const REPO_NAME = process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/')[1] : 'kimuwiki';
const BASE_URL = `/${REPO_NAME}`;

// Ensure output directory exists
fs.ensureDirSync(OUTPUT_DIR);

// Custom renderer for links to handle internal wiki links
const defaultRender = md.renderer.rules.link_open || function(tokens, idx, options, env, self) {
  return self.renderToken(tokens, idx, options);
};

md.renderer.rules.link_open = function(tokens, idx, options, env, self) {
  const token = tokens[idx];
  const href = token.attrs.find(attr => attr[0] === 'href');
  
  if (href && href[1].endsWith('.md')) {
    // Convert internal .md links to .html links with correct base path
    href[1] = BASE_URL + '/' + href[1].replace('.md', '.html');
  } else if (href && !href[1].startsWith('http') && !href[1].startsWith('#')) {
    // Add base path to other internal links
    href[1] = BASE_URL + href[1];
  }
  
  return defaultRender(tokens, idx, options, env, self);
};

// Generate sidebar navigation structure
const generateSidebar = (files) => {
  const navigation = [];
  
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    
    // Skip special GitHub wiki files and Home.md
    if (file.startsWith('_') || file.toLowerCase() === 'home.md') continue;
    
    const content = fs.readFileSync(path.join(WIKI_DIR, file), 'utf8');
    const { attributes } = frontMatter(content);
    
    navigation.push({
      title: attributes.title || file.replace('.md', '').replace(/-/g, ' '),
      url: BASE_URL + '/' + file.replace('.md', '.html'),
      order: attributes.order || 999
    });
  }
  
  return navigation.sort((a, b) => a.order - b.order);
};

// Process all markdown files
const processWikiFiles = async () => {
  const files = await fs.readdir(WIKI_DIR);
  
  // Generate sidebar navigation
  const sidebarNav = generateSidebar(files);
  const sidebarHtml = sidebarNav
    .map(item => `<li><a href="${item.url}">${item.title}</a></li>`)
    .join('\n');
  
  // Read the HTML template
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  
  for (const file of files) {
    if (!file.endsWith('.md')) continue;

    const content = await fs.readFile(path.join(WIKI_DIR, file), 'utf8');
    const { attributes, body } = frontMatter(content);
    
    // Convert markdown to HTML
    const htmlContent = md.render(body);
    
    // Insert into template
    const finalHtml = template
      .replace(/\{\{title\}\}/g, attributes.title || file.replace('.md', '').replace(/-/g, ' '))
      .replace('{{content}}', htmlContent)
      .replace('{{sidebar}}', sidebarHtml)
      .replace(/\{\{base_url\}\}/g, BASE_URL)
      .replace(/\{\{repo_owner\}\}/g, REPO_OWNER)
      .replace(/\{\{repo_name\}\}/g, REPO_NAME)
      .replace(/\{\{wiki_page\}\}/g, file.replace('.md', ''));
    
    // Write to output directory
    const outputPath = path.join(OUTPUT_DIR, file.replace('.md', '.html'));
    await fs.writeFile(outputPath, finalHtml);
  }

  // Generate index.html from Home.md if it exists
  if (files.includes('Home.md')) {
    const homePath = path.join(OUTPUT_DIR, 'Home.html');
    if (await fs.pathExists(homePath)) {
      await fs.copy(homePath, path.join(OUTPUT_DIR, 'index.html'));
    }
  }
};

processWikiFiles().catch(console.error);
