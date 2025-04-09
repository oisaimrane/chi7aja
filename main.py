import discord
import os
import asyncio
import requests
import random
from discord.ext import commands
from spotipy import Spotify
from spotipy.oauth2 import SpotifyClientCredentials
import yt_dlp
from flask import Flask
from threading import Thread
from dotenv import load_dotenv

load_dotenv()

USER_TOKEN = os.getenv("USER_TOKEN")
MAIN_USER_ID = int(os.getenv("MAIN_USER_ID"))
SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
GIPHY_API_KEY = os.getenv("GIPHY_API_KEY")

AUTO_REPLY_TEXT = "Hey! My admin will get back to you soon. 😉"
TRIGGER_WORDS = ["fire", "wow", "bruh", "sus"]

intents = discord.Intents.all()
bot = commands.Bot(command_prefix="!", self_bot=True, intents=intents)
vc_client = None

# Flask server to keep Glitch project alive
app = Flask('')

@app.route('/')
def home():
    return "Selfbot running."

def run():
    app.run(host='0.0.0.0', port=8080)

Thread(target=run).start()

spotify = Spotify(auth_manager=SpotifyClientCredentials(
    client_id=SPOTIFY_CLIENT_ID,
    client_secret=SPOTIFY_CLIENT_SECRET
))

@bot.event
async def on_ready():
    print(f"[✔️] Logged in as {bot.user}")

@bot.command()
async def join(ctx):
    if ctx.author.id != MAIN_USER_ID:
        return
    if ctx.author.voice:
        global vc_client
        channel = ctx.author.voice.channel
        vc_client = await channel.connect()
        await ctx.send("🎧 Joined voice channel!")
    else:
        await ctx.send("❌ You're not in a voice channel.")

@bot.command()
async def leave(ctx):
    global vc_client
    if vc_client:
        await vc_client.disconnect()
        await ctx.send("👋 Left the channel.")
        vc_client = None

@bot.command()
async def stop(ctx):
    global vc_client
    if vc_client and vc_client.is_playing():
        vc_client.stop()
        await ctx.send("⏹️ Stopped playback.")

@bot.command()
async def play(ctx, *, query):
    if ctx.author.id != MAIN_USER_ID:
        return
    global vc_client

    if not vc_client:
        await ctx.send("❌ I'm not in a voice channel. Use `!join` first.")
        return

    urls = []

    if "spotify.com/track" in query:
        track = spotify.track(query)
        search_query = f"{track['name']} {track['artists'][0]['name']}"
        urls.append(search_query)

    elif "spotify.com/playlist" in query:
        playlist = spotify.playlist_tracks(query)
        for item in playlist['items']:
            track = item['track']
            search_query = f"{track['name']} {track['artists'][0]['name']}"
            urls.append(search_query)

    elif "youtube.com" in query or "youtu.be" in query:
        urls.append(query)

    else:
        urls.append(query)

    for song in urls:
        await ctx.send(f"▶️ Playing: {song}")
        filename = "song.mp3"

        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': filename,
            'quiet': True,
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([f"ytsearch:{song}" if not song.startswith("http") else song])

        vc_client.play(discord.FFmpegPCMAudio(executable="ffmpeg", source=filename))
        while vc_client.is_playing():
            await asyncio.sleep(1)

    await ctx.send("✅ Finished playlist!")

def get_gif_url(query):
    url = f"https://api.giphy.com/v1/gifs/search?api_key={GIPHY_API_KEY}&q={query}&limit=1&rating=g"
    response = requests.get(url).json()
    if response["data"]:
        return response["data"][0]["images"]["original"]["url"]
    return None

@bot.event
async def on_message(message):
    if message.author.id == bot.user.id:
        return

    if any(user.id == MAIN_USER_ID for user in message.mentions):
        try:
            await message.reply(AUTO_REPLY_TEXT)
        except Exception as e:
            print(f"[❌] Couldn't reply: {e}")

    if message.author.id == MAIN_USER_ID:
        for word in TRIGGER_WORDS:
            if word in message.content.lower():
                gif_url = get_gif_url(word)
                if gif_url:
                    try:
                        await message.channel.send(gif_url)
                    except Exception as e:
                        print(f"[❌] Failed to send GIF: {e}")
                break

    await bot.process_commands(message)

bot.run(USER_TOKEN)
