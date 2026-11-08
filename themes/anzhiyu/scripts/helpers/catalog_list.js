hexo.extend.helper.register("catalog_list", function (type) {
  // 注意：站点可能部署在子路径（root=/blog/），这里必须带上 root
  let root = hexo.config.root || '/';
  if (!root.endsWith('/')) root += '/';
  let html = ``;
  hexo.locals.get(type).map(function (item) {
    html += `
    <div class="catalog-list-item" id="${root}${item.path}">
      <a href="${root}${item.path}">
        ${item.name}
      </a>
    </div>
    `;
  });
  return html;
});
