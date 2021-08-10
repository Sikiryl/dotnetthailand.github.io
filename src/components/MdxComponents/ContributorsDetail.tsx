import React, { useState } from 'react';
import axios from 'axios';
import { useTheme } from 'emotion-theming';
import { useEffect } from 'react';
import { css } from '@emotion/core';
import { DefaultButton } from '@fluentui/react/lib/Button';
import styled from '@emotion/styled';
import { Persona, PersonaSize } from '@fluentui/react/lib/Persona';
import { ProgressIndicator } from '@fluentui/react/lib/ProgressIndicator';

// Feature Toggle
const feature = {
  ignoreMergePullRequest: true,
  ignoreFilesExtension: true,
}

const GithubProfile = styled.div`
  margin: 40px 0px;
`;


const style = theme => css`

  width: 100%;
  margin-top: 40px;

  .profile {
    & > img {
      border-radius: 50%;
      width: 100px;
      height: 100px;
    }
  }

`;


const repo = 'dotnetthailand/dotnetthailand.github.io';
const axiosConfig = {
  headers: {
    'Accept': 'application/vnd.github.v3+json'
  }
}

// TODO: ignore font extension. woff

const ignoreFilesExtension: RegExp[] = [
  /\.woff$/,
  /yarn.lock/
];

interface IFile {
  commitCount: number;
  filename: string;
  contentUrl: string;
  title?: string;
  isContent: boolean;
}

interface IGithubUser {
  profileUrl?: string,
  avatarUrl?: string,
  name?: string,
}

const setTimeoutPromise = (timeout: number) => new Promise(resolve => {
  setTimeout(resolve, timeout);
});

const getUserRole = () => {
  return "Content Editor, Maintainer, Developer"
}


const fetchRetry = async (url: string, delayTime: number, limit: number): Promise<any> => {
  if (limit < 0) {
    console.warn(`Try to fetch '${url}' over limit`);
    return;
  }
  try {
    return axios.get(url, axiosConfig);
  } catch (e) {
    console.warn(`Something wrong: ${e}`);
    await setTimeoutPromise(delayTime * 1000);
    return fetchRetry(url, delayTime, limit - 1);
  }
}

const isContent = (filename: string) => {
  return /^content/.test(filename);
}

const isIgnoreFile = (filename: string) => {
  for (const regex of ignoreFilesExtension) {
    if (regex.test(filename)) return true;
  }
  return false;
}

const isMergePullRequest = (commitMessage: string) => {
  return /^Merge pull request #\d+/.test(commitMessage);
}

const getTitle = async (rssData: string, path: string) => {
  const absolutePath = `https://www.dotnetthailand.com/${path.replace(/^\//, '')}`;
  let xmlDoc = new DOMParser().parseFromString(rssData, "text/xml");
  for (const item of xmlDoc.getElementsByTagName('item')) {
    const currentLink = item.getElementsByTagName('link')[0].childNodes[0].nodeValue;
    if (absolutePath === currentLink) {
      const title = item.getElementsByTagName('title')[0].childNodes[0].nodeValue.replace("<![CDATA[", "").replace("]]>", "");
      return title;
    }
  }
  return;
}

const initFiles = [];

const ContributorsDetail = ({ username }: { username: string }) => {
  const theme = useTheme();
  const [files, setFiles] = useState(initFiles);
  const [contentFiles, setContentFiles] = useState(initFiles);
  const [loading, setLoading] = useState(false);
  const [githubUser, setGithubUser] = useState({} as IGithubUser);
  const [percentComplete, setPercentComplete] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const rssData = (await fetchRetry(`https://www.dotnetthailand.com/rss.xml`, 3, 3)).data;
      const data = (await fetchRetry(`https://api.github.com/repos/${repo}/commits?author=${username}`, 3, 3)).data;
      const commitListTmp = data.map(commitData => ({
        date: commitData?.commit?.author?.date,
        message: commitData?.commit?.message,
        url: commitData?.url,
      }));

      const fileDictionary: Record<string, IFile> = {};
      const contentFileDictionary: Record<string, IFile> = {};
      for (let i = 0; i < commitListTmp.length; i++) {
        const commitData = commitListTmp[i];
        const commitFiles = (await fetchRetry(commitData?.url, 3, 3)).data;
        for (const commitFile of commitFiles.files) {

          if (isIgnoreFile(commitFile.filename) && feature.ignoreFilesExtension) continue;
          if (isMergePullRequest(commitData.message) && feature.ignoreMergePullRequest) continue;

          const contentUrl = commitFile.filename.replace(/^content/, '').replace(/\..+$/, '');
          const absolutePath = `https://www.dotnetthailand.com/${contentUrl.replace(/^\//, '')}`;
          const title = await getTitle(rssData, contentUrl);
          const newFile: IFile = {
            commitCount: 1,
            filename: commitFile.filename,
            contentUrl: title ? absolutePath : commitFile.blob_url,
            title,
            isContent: isContent(commitFile.filename),
          }

          if (isContent(commitFile.filename)) {
            if (contentFileDictionary[commitFile.filename])
              contentFileDictionary[commitFile.filename].commitCount++;
            else
              contentFileDictionary[commitFile.filename] = newFile;
          } else {
            if (fileDictionary[commitFile.filename])
              fileDictionary[commitFile.filename].commitCount++;
            else
              fileDictionary[commitFile.filename] = newFile;
          }
        }


        const serializedFileList = Object.entries(fileDictionary)
          .map(([, file]) => file)
          .sort((a, b) => (a.title && !b.title) ? 1 : -1)
          .sort((a, b) => (a.commitCount < b.commitCount) ? 1 : -1);
        const serializedContentFileList = Object.entries(contentFileDictionary)
          .map(([, file]) => file)
          .sort((a, b) => (a.title && !b.title) ? 1 : -1)
          .sort((a, b) => (a.commitCount < b.commitCount) ? 1 : -1);

        setFiles(serializedFileList);
        setContentFiles(serializedContentFileList);
        setPercentComplete(Math.ceil((i+1)/commitListTmp.length));
      }

      setLoading(false);
    }

    const fetchGithubUser = async () => {
      const data = (await fetchRetry(`https://api.github.com/users/${username}`, 3, 3)).data;
      setGithubUser({
        profileUrl: data?.html_url,
        avatarUrl: data?.avatar_url,
        name: data?.name,
      })
    }

    fetchGithubUser();
    fetch();
  }, []);

  return (
    <div css={style(theme)}>
      <DefaultButton text="Back" href="/contributors" />

      <GithubProfile>
        <a href={githubUser.profileUrl} target='_blank' rel='noreferrer' >
          <Persona
            imageUrl={githubUser.avatarUrl}
            imageInitials={githubUser.name}
            text={githubUser.name}
            secondaryText={getUserRole()}
            tertiaryText={`@${username}`}
            size={PersonaSize.size72}
            hidePersonaDetails={false}
            imageAlt={username}
          />
        </a>
      </GithubProfile>

      <h4>{loading && <ProgressIndicator label="Extracting git commit history" percentComplete={percentComplete} />}</h4>
      <h2>Content</h2>
      {contentFiles.map((file: IFile) => (
        <div key={file.filename}>
          {file.title ? <a href={file.contentUrl} target='_blank' rel='noreferrer'>{file.title}</a> : <a href={file.contentUrl} target='_blank' rel='noreferrer'>{file.filename}</a>}
          ({file.commitCount})
          <a href={`https://github.com/${repo}/commits/main/${file.filename}`} target='_blank' rel='noreferrer'>Commit History</a>
        </div>
      ))}
      <h2>Web Development</h2>
      <div>
        {files.map((file: IFile) => (
          <div key={file.filename}>
            {file.title ? <a href={file.contentUrl} target='_blank' rel='noreferrer'>{file.title}</a> : <a href={file.contentUrl} target='_blank' rel='noreferrer'>{file.filename}</a>}
            ({file.commitCount})
            <a href={`https://github.com/${repo}/commits/main/${file.filename}`} target='_blank' rel='noreferrer'>Commit History</a>
          </div>
        ))}
      </div>
    </div>
  )
};

export default ContributorsDetail;
