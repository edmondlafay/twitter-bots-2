var Twitter = require('twitter');
var async = require('async');
var config = require('./config.js');
var T = new Twitter(config);

const TWEET_TEXT = [
  'Need!', 'Excellent!', 'Gooo!', 'Wow!', 'Nice!', 'Cool!',
  'Super!', 'OMG!', 'Yeah!', 'Top!', 'GG!', 'Must!'
];
let LIMIT_COUNT = {likes: 0, follows: 0};
let TWEETS_FOUND = [];

// Set up your search parameters
var params = {
  q: '"follow" "RT" "concours" filter:links -fortnite -skin -vbucks -instagram',
  count: 100,
  result_type: 'recent',
  lang: 'fr'
};

const sleep = (milliseconds) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function handleTweet(tweetId, username, followingAuthor, alreadyDone, mentions, hashtags) {
  participationFunctions = [
    function(callback) {
      // build tweet url for logging purposes
      callback(null, {tweetId: tweetId, username: username});
    },
    function(callback) {
      // Try to Favorite the selected Tweet
      if (alreadyDone) {
        return callback(null, 'already favorited');
      }
      T.post('favorites/create', {id: tweetId}, function(err){
        if(err && err[0].message != 'You have already favorited this status.'){
          callback(new Error(`https://twitter.com/${username}/status/${tweetId} favorites error :` + err[0].message));
        } else {
          LIMIT_COUNT['likes'] = LIMIT_COUNT['likes'] + 1;
          callback(null, 'favorited');
        }
      });
    },
    function(callback) {
      // Try to Follow the selected Tweet author
      if (followingAuthor) {
        return callback(null, 'already followed');
      }
      T.post('friendships/create', {screen_name: username}, function(err){
        if(err){
          callback(new Error(`https://twitter.com/${username}/status/${tweetId} friendships error :` + err[0].message));
        } else {
          LIMIT_COUNT['follows'] = LIMIT_COUNT['follows'] + 1;
          callback(null, 'followed');
        }
      });
    },
    function(callback) {
      // Try to retweet the selected Tweet
      if (alreadyDone) {
        return callback(null, 'already retweeted');
      }
      T.post('statuses/retweet', {id: tweetId}, function(err){
        if(err){
          callback(new Error(`https://twitter.com/${username}/status/${tweetId} retweet error :` + err[0].message));
        } else {
          callback(null, 'retweeted');
        }
      });
    },
    function(callback) {
      // Try to tweet the selected Tweet with hashtags and friend mentions
      if (alreadyDone) {
        return callback(null, '');
      }
      T.post('statuses/update', {
        status: `@${username} ${TWEET_TEXT[Math.floor(Math.random()*TWEET_TEXT.length)]} @realDonaldTrump @year_progress @TayTweets ${hashtags.join( )}`,
        attachment_url: `https://twitter.com/${username}/status/${tweetId}`,
        in_reply_to_status_id: tweetId
      }, function(err){
        if(err) {
          callback(new Error(`https://twitter.com/${username}/status/${tweetId} tweet error :` + err[0].message));
        } else {
          callback(null, 'tweeted with hashtags and friends');
        }
      });
    }
  ];
  // Try to Follow the selected Tweet mentions
  if (!alreadyDone) {
    for (const mention of mentions) {
      participationFunctions.push(
        function(callback) {
          T.post('friendships/create', {screen_name: mention}, function(err){
            if(err){
              callback(new Error(`https://twitter.com/${username}/status/${tweetId} friendships error :` + err[0].message));
            } else {
              LIMIT_COUNT['follows'] = LIMIT_COUNT['follows'] + 1;
              callback(null, 'friend followed');
            }
          });
        }
      );
    }
  }

  async.parallel(participationFunctions, function(err, results) {
    if (err) { console.log(err); }
    else {
      console.log(`https://twitter.com/${results[0].username}/status/${results[0].tweetId} ${results.slice(1)}`)
    }
  });
}

function parseTweet(tweet) {
  let tweetId, username, alreadyDone, followingAuthor;
  let mentions = [];
  let hashtags = [];
  tweetId = tweet.id_str;
  username = tweet.user.screen_name;
  alreadyDone = tweet.favorited && tweet.retweeted;
  followingAuthor = tweet.user.following;
  for (const mention of tweet.entities.user_mentions) {
    mentions.push(mention.screen_name);
  }
  for (const hashtag of tweet.entities.hashtags) {
    hashtags.push(`#${hashtag.text}`);
  }
  if (followingAuthor && alreadyDone) {
    return false;
  } else {
    handleTweet(tweetId, username, followingAuthor, alreadyDone, mentions.slice(), hashtags.slice());
    return true;
  }
}

async function nextTweetFound(i) {
  // Get the tweet Id from the returned data
  if (TWEETS_FOUND[i].retweeted_status) {
    const id = TWEETS_FOUND[i].retweeted_status.id_str
    T.get('statuses/show', {id: id}, async (err, data) => {
      if(!err) {
        if (parseTweet(data)) {
          await sleep(10000);
        }
        i+=1;
        if (i < TWEETS_FOUND.length && LIMIT_COUNT['likes']<=10 && LIMIT_COUNT['follows']<=10) {
          nextTweetFound(i);
        }
      } else {
        console.log(id + ' get tweet error :', err);
      }
    });
  } else {
    if (parseTweet(TWEETS_FOUND[i])) {
      await sleep(10000);
    }
    i+=1;
    if (i < TWEETS_FOUND.length && LIMIT_COUNT['likes']<=10 && LIMIT_COUNT['follows']<=10) {
      nextTweetFound(i);
    }
  }
}

// Initiate your search using the above parameters
T.get('search/tweets', params, async (err, data) => {
  if(!err) {
    TWEETS_FOUND = data.statuses
    let i = 0
    if (i < TWEETS_FOUND.length && LIMIT_COUNT['likes']<=10 && LIMIT_COUNT['follows']<=10) {
      nextTweetFound(i)
    }
  } else {
    console.log('get all tweets error :', err);
  }
});
