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

// Ensure output directory exists
fs.ensureDirSync(OUTPUT_DIR);

// Read the HTML template
const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

// Process all markdown files
// Generate sidebar navigation structure
const generateSidebar = (files) => {
  const navigation = [];
  
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    
    const content = fs.readFileSync(path.join(WIKI_DIR, file), 'utf8');
    const { attributes } = frontMatter(content);
    
    navigation.push({
      title: attributes.title || path.basename(file, '.md'),
      url: '/' + file.replace('.md', '.html'),
      order: attributes.order || 999
    });
  }
  
  return navigation.sort((a, b) => a.order - b.order);
};

const processWikiFiles = async () => {
  const files = await fs.readdir(WIKI_DIR);
  
  // Generate sidebar navigation
  const sidebarNav = generateSidebar(files);
  const sidebarHtml = sidebarNav
    .map(item => `<li><a href="${item.url}">${item.title}</a></li>`)
    .join('\n');
  
  for (const file of files) {
    if (!file.endsWith('.md')) continue;

    const content = await fs.readFile(path.join(WIKI_DIR, file), 'utf8');
    const { attributes, body } = frontMatter(content);
    
    // Convert markdown to HTML
    const htmlContent = md.render(body);
    
    // Insert into template
    const finalHtml = template
      .replace('{{title}}', attributes.title || path.basename(file, '.md'))
      .replace('{{content}}', htmlContent)
      .replace('{{sidebar}}', sidebarHtml);
    
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
