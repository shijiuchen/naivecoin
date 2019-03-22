#!/bin/bash

# the default node number is 3
N=${1:-3}

# start hadoop master container
echo "start hadoop-master container..."
docker run -itd \
                --network=testnetwork \
                -p 50071:50071 \
                -p 8088:8088 \
                --name hadoop-master \
                --hostname hadoop-master \
                kiwenlau/hadoop:1.0 &> /dev/null

# start hadoop slave container
echo "start hadoop-slave1 container..."
docker run -itd --network=testnetwork --name hadoop-slave1 --hostname hadoop-slave1 kiwenlau/hadoop:1.0 &> /dev/null
echo "start hadoop-slave2 container..."
docker run -itd --network=testnetwork --name hadoop-slave2 --hostname hadoop-slave2 kiwenlau/hadoop:1.0 &> /dev/null
# get into hadoop master container
#sudo docker exec -it hadoop-master bash
docker exec hadoop-master /root/start-hadoop.sh

#docker exec hadoop-master bash -c "mkdir input && echo 'hello hadoop hello'>file1.txt && echo 'hello hello docker'>file2.txt"

#docker exec hadoop-master /root/run-wordcount.sh
docker exec hadoop-master bash -c "mkdir input"
docker cp /home/syc/eth-simulation/naivecoin/file0.txt hadoop-master:/root/input/
docker exec hadoop-master bash -c "hadoop fs -mkdir -p input && hdfs dfs -put ./input/* input && hadoop jar /usr/local/hadoop/share/hadoop/mapreduce/sources/hadoop-mapreduce-examples-2.7.2-sources.jar org.apache.hadoop.examples.WordCount input output && echo -e '\ninput file0.txt:' && hdfs dfs -cat input/file0.txt"
docker exec hadoop-master bash -c "echo -e '\nwordcount output:' && hdfs dfs -cat output/part-r-00000 > resHadoop.txt"
docker cp hadoop-master:/root/resHadoop.txt /home/syc/eth-simulation/naivecoin/resHadoop.txt
docker stop -f hadoop-master &> /dev/null
docker stop -f hadoop-slave1 &> /dev/null
docker stop -f hadoop-slave2 &> /dev/null
docker rm -f hadoop-master &> /dev/null
docker rm -f hadoop-slave1 &> /dev/null
docker rm -f hadoop-slave2 &> /dev/null