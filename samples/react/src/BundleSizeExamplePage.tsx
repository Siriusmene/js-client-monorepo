import { ReactNode, useEffect, useState } from 'react';

function formatSize(bytes: number) {
  if (bytes < 0) {
    return '...';
  }

  if (bytes < 1024) {
    return bytes + ' bytes';
  } else if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(2) + ' KB';
  } else {
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }
}

async function fetchAndGetSizes(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP error! Status: ${res.status}`);
  }
  const buffer = await res.arrayBuffer();

  const compressed = parseInt(res.headers.get('Content-Length') ?? '-1');
  const uncompressed = buffer.byteLength;
  return { compressed, uncompressed };
}

function BundleDetails({ url, title }: { url: string; title: string }) {
  const [sizes, setSizes] = useState({ uncompressed: -1, compressed: -1 });

  useEffect(() => {
    fetchAndGetSizes(url)
      .then((sizes) => setSizes(sizes))
      // eslint-disable-next-line no-console
      .catch((reason) => console.error(reason));
  }, [url]);

  return (
    <>
      <h2>{title}</h2>
      <div>Compressed: {formatSize(sizes.compressed)}</div>
      <div>Uncompressed: {formatSize(sizes.uncompressed)}</div>
    </>
  );
}

export default function BundleSizeExamplePage(): ReactNode {
  return (
    <>
      <BundleDetails
        title="@statsig/js-client"
        url="https://cdn.jsdelivr.net/npm/@statsig/js-client@3/build/statsig-js-client.min.js"
      />

      <BundleDetails
        title="@statsig/js-on-device-eval-client"
        url="https://cdn.jsdelivr.net/npm/@statsig/js-on-device-eval-client@1/build/statsig-js-on-device-eval-client.min.js"
      />

      <BundleDetails
        title="@statsig/js-client+web-analytics+session-replay"
        url="https://cdn.jsdelivr.net/npm/@statsig/js-client@3/build/statsig-js-client+session-replay+web-analytics.min.js"
      />
    </>
  );
}
