# プロキシ (Purokishi)

A proxy server made out necessity.

## History

I was sitting in a co-working space in Kobe, Japan, when I decided to listen to some tunes on my preferred internet music site, Songza.

 It turns out that they are blocking requests from Japanese IP addresses (or more correctly, redirecting them to their text content site [daily.songza.com](http://daily.songza.com/), which is not bad, just not what I wanted at the time). It turns out that this is common practice for internet music sites, as I was unable to use all of the following:

- Songza
- Pandora

Ok, so not that many, but you get the point. So, I decided to roll my own proxy server in Node.js to get in the groove of writing code again, after my two-week hiatus post my decision to move to the other side of the world. There a couple of existing modules that did this already, but I really wanted get into the nitty gritty of the whole HTTP/S request lifecycle and stretch my mental programming muscles. Additionally, none of the options out there seemed to clearly illustrate the process.

So please enjoy, hopefully someone out there finds this helpful!
