hexo.extend.helper.register('tags_page_list', function (type) {
  const tags = hexo.locals.get(type);
  // 站点可能部署在子路径（root=/blog/），链接必须带 root
  let root = hexo.config.root || '/';
  if (!root.endsWith('/')) root += '/';

  // Manually sort tags based on the length of tag names
  const sortedTags = tags.reduce((acc, tag) => {
    const index = acc.findIndex((t) => t.length < tag.length);
    if (index === -1) {
      acc.push(tag);
    } else {
      acc.splice(index, 0, tag);
    }
    return acc;
  }, []);

  let html = ``;
  sortedTags.forEach(function (item) {
    html += `
      <a href="${root}${item.path}" id="${root}${item.path}">
        <span class="tags-punctuation">#</span>${item.name}
        <span class="tagsPageCount">${item.length}</span>
      </a>
    `;
  });

  return html;
});