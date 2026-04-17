import { siteConfig } from "../../lib/site-config";

import { OpenSphinxMark } from "./opensphinx-mark";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner site-container">
        <div className="site-footer__meta">
          <OpenSphinxMark className="site-footer__logo" size={28} />
          <div className="site-footer__meta-text">
            <strong>{siteConfig.name}</strong>
            <p>{siteConfig.description}</p>
          </div>
        </div>

        <div className="site-footer__links">
          <a href={siteConfig.links.github} rel="noreferrer" target="_blank">
            GitHub
          </a>
          <a href={siteConfig.links.npm} rel="noreferrer" target="_blank">
            npm
          </a>
          <span>MIT License</span>
        </div>
      </div>
    </footer>
  );
}
